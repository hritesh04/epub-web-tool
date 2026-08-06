package otel

import (
	"context"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/trace"
)

// TraceLogger returns a zerolog.Logger whose trace_id/span_id fields are
// populated from the active span in ctx, so logs correlate with traces.
func TraceLogger(ctx context.Context) zerolog.Logger {
	spanCtx := trace.SpanContextFromContext(ctx)
	if !spanCtx.IsValid() {
		return log.With().Logger()
	}
	return log.With().
		Str("trace_id", spanCtx.TraceID().String()).
		Str("span_id", spanCtx.SpanID().String()).
		Logger()
}
