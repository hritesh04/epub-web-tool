package otel

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otellog "go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func InitOTel(ctx context.Context, cfg config.OpenObserve) (shutdown func(context.Context) error, err error) {
	var shutdownFuncs []func(context.Context) error

	shutdown = func(ctx context.Context) error {
		var err error
		for _, fn := range shutdownFuncs {
			if e := fn(ctx); e != nil {
				err = e
			}
		}
		return err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName("epub-web-tool"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(cfg.User+":"+cfg.Password))
	headers := map[string]string{
		"Authorization": authHeader,
	}

	// TRACES
	traceExporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(cfg.Endpoint),
		otlptracehttp.WithURLPath(fmt.Sprintf("/api/%s/v1/traces", cfg.Organization)),
		otlptracehttp.WithInsecure(), // Change to WithTLS if needed
		otlptracehttp.WithHeaders(headers),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	shutdownFuncs = append(shutdownFuncs, tp.Shutdown)

	// METRICS
	metricExporter, err := otlpmetrichttp.New(ctx,
		otlpmetrichttp.WithEndpoint(cfg.Endpoint),
		otlpmetrichttp.WithURLPath(fmt.Sprintf("/api/%s/v1/metrics", cfg.Organization)),
		otlpmetrichttp.WithInsecure(),
		otlpmetrichttp.WithHeaders(headers),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create metric exporter: %w", err)
	}

	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExporter, sdkmetric.WithInterval(15*time.Second))),
		sdkmetric.WithResource(res),
	)
	otel.SetMeterProvider(mp)
	shutdownFuncs = append(shutdownFuncs, mp.Shutdown)

	// LOGS
	logExporter, err := otlploghttp.New(ctx,
		otlploghttp.WithEndpoint(cfg.Endpoint),
		otlploghttp.WithURLPath(fmt.Sprintf("/api/%s/v1/logs", cfg.Organization)),
		otlploghttp.WithInsecure(),
		otlploghttp.WithHeaders(headers),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create log exporter: %w", err)
	}

	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExporter)),
		sdklog.WithResource(res),
	)
	global.SetLoggerProvider(lp)
	shutdownFuncs = append(shutdownFuncs, lp.Shutdown)

	return shutdown, nil
}

type OTelWriter struct {
	logger otellog.Logger
}

func NewZerologWriter() io.Writer {
	return &OTelWriter{
		logger: global.GetLoggerProvider().Logger("zerolog-bridge"),
	}
}

func (w *OTelWriter) Write(p []byte) (n int, err error) {
	var data map[string]interface{}
	if err := json.Unmarshal(p, &data); err != nil {
		return 0, err
	}

	record := otellog.Record{}
	record.SetTimestamp(time.Now())

	if msg, ok := data["message"].(string); ok {
		record.SetBody(otellog.StringValue(msg))
	} else if msg, ok := data["msg"].(string); ok {
		record.SetBody(otellog.StringValue(msg))
	}

	// Severity
	if level, ok := data["level"].(string); ok {
		switch level {
		case "debug":
			record.SetSeverity(otellog.SeverityDebug)
		case "info":
			record.SetSeverity(otellog.SeverityInfo)
		case "warn":
			record.SetSeverity(otellog.SeverityWarn)
		case "error":
			record.SetSeverity(otellog.SeverityError)
		case "fatal":
			record.SetSeverity(otellog.SeverityFatal)
		}
	}

	// Attributes
	for k, v := range data {
		if k == "message" || k == "msg" || k == "level" || k == "time" {
			continue
		}
		switch val := v.(type) {
		case string:
			record.AddAttributes(otellog.String(k, val))
		case float64:
			record.AddAttributes(otellog.Float64(k, val))
		case bool:
			record.AddAttributes(otellog.Bool(k, val))
		}
	}

	w.logger.Emit(context.Background(), record)
	return len(p), nil
}
