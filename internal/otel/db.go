package otel

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type contextKey int

const (
	queryTraceKey contextKey = iota
	copyTraceKey
)

type traceData struct {
	span      trace.Span
	start     time.Time
	operation string
}

// PGXQueryTracer creates a child span and records metrics for every query and
// CopyFrom executed through pgx.
type PGXQueryTracer struct{}

func NewPGXQueryTracer() *PGXQueryTracer {
	return &PGXQueryTracer{}
}

func dbOperationName(sql string) string {
	trimmed := strings.TrimSpace(sql)
	upper := strings.ToUpper(trimmed)
	switch {
	case strings.HasPrefix(upper, "SELECT"):
		return "SELECT"
	case strings.HasPrefix(upper, "INSERT"):
		return "INSERT"
	case strings.HasPrefix(upper, "UPDATE"):
		return "UPDATE"
	case strings.HasPrefix(upper, "DELETE"):
		return "DELETE"
	default:
		if i := strings.IndexByte(trimmed, ' '); i > 0 {
			return strings.ToUpper(trimmed[:i])
		}
		return trimmed
	}
}

func (t *PGXQueryTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	operation := dbOperationName(data.SQL)
	ctx, span := otel.Tracer("db").Start(ctx, "db.query",
		trace.WithAttributes(
			attribute.String("db.system", "postgresql"),
			attribute.String("db.operation", operation),
			attribute.String("db.statement", data.SQL),
			attribute.Int("db.args", len(data.Args)),
		),
	)
	return context.WithValue(ctx, queryTraceKey, &traceData{span: span, start: time.Now(), operation: operation})
}

func (t *PGXQueryTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	td, ok := ctx.Value(queryTraceKey).(*traceData)
	if !ok {
		return
	}
	td.span.SetAttributes(attribute.String("db.command", data.CommandTag.String()))
	if data.Err != nil {
		td.span.RecordError(data.Err)
		td.span.SetStatus(codes.Error, data.Err.Error())
	}
	td.span.End()
	RecordDBQuery(ctx, td.operation, time.Since(td.start).Seconds(), data.Err)
}

func (t *PGXQueryTracer) TraceCopyFromStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceCopyFromStartData) context.Context {
	ctx, span := otel.Tracer("db").Start(ctx, "db.copy",
		trace.WithAttributes(
			attribute.String("db.system", "postgresql"),
			attribute.String("db.operation", "COPY"),
			attribute.String("db.table", data.TableName.Sanitize()),
			attribute.StringSlice("db.columns", data.ColumnNames),
		),
	)
	return context.WithValue(ctx, copyTraceKey, &traceData{span: span, start: time.Now(), operation: "COPY"})
}

func (t *PGXQueryTracer) TraceCopyFromEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceCopyFromEndData) {
	td, ok := ctx.Value(copyTraceKey).(*traceData)
	if !ok {
		return
	}
	td.span.SetAttributes(attribute.String("db.command", data.CommandTag.String()))
	if data.Err != nil {
		td.span.RecordError(data.Err)
		td.span.SetStatus(codes.Error, data.Err.Error())
	}
	td.span.End()
	RecordDBQuery(ctx, td.operation, time.Since(td.start).Seconds(), data.Err)
}
