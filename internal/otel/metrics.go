package otel

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

var (
	httpRequestsCounter   metric.Int64Counter
	httpDurationHistogram metric.Float64Histogram
	httpErrorsCounter     metric.Int64Counter
	activeRequestsGauge   metric.Int64UpDownCounter
	translationsCounter   metric.Int64Counter
	uploadsCounter        metric.Int64Counter
)

func InitMetrics() error {
	meter := otel.Meter("epub-web-tool")

	var err error

	httpRequestsCounter, err = meter.Int64Counter(
		"http.server.requests",
		metric.WithDescription("Total number of HTTP requests"),
	)
	if err != nil {
		return err
	}

	httpDurationHistogram, err = meter.Float64Histogram(
		"http.server.duration",
		metric.WithDescription("HTTP request duration in milliseconds"),
		metric.WithUnit("ms"),
	)
	if err != nil {
		return err
	}

	httpErrorsCounter, err = meter.Int64Counter(
		"http.server.errors",
		metric.WithDescription("Total number of HTTP errors"),
	)
	if err != nil {
		return err
	}

	activeRequestsGauge, err = meter.Int64UpDownCounter(
		"http.server.active_requests",
		metric.WithDescription("Number of active HTTP requests"),
	)
	if err != nil {
		return err
	}

	translationsCounter, err = meter.Int64Counter(
		"translations.total",
		metric.WithDescription("Total number of translation operations"),
	)
	if err != nil {
		return err
	}

	uploadsCounter, err = meter.Int64Counter(
		"uploads.total",
		metric.WithDescription("Total number of upload operations"),
	)
	if err != nil {
		return err
	}

	return nil
}

type RequestLabels struct {
	Method string
	Route  string
	Status int
}

func RecordRequest(ctx context.Context, labels RequestLabels, durationMs float64) {
	attrs := []attribute.KeyValue{
		attribute.String("http.method", labels.Method),
		attribute.String("http.route", labels.Route),
		attribute.Int("http.status_code", labels.Status),
	}

	httpRequestsCounter.Add(ctx, 1, metric.WithAttributes(attrs...))
	httpDurationHistogram.Record(ctx, durationMs, metric.WithAttributes(attrs...))

	if labels.Status >= 400 {
		httpErrorsCounter.Add(ctx, 1, metric.WithAttributes(attrs...))
	}
}

func RecordTranslation(ctx context.Context) {
	translationsCounter.Add(ctx, 1)
}

func RecordUpload(ctx context.Context) {
	uploadsCounter.Add(ctx, 1)
}

func IncActiveRequests(ctx context.Context) {
	activeRequestsGauge.Add(ctx, 1)
}

func DecActiveRequests(ctx context.Context) {
	activeRequestsGauge.Add(ctx, -1)
}

type Middleware struct{}

func NewMetricsMiddleware() *Middleware {
	return &Middleware{}
}

func (m *Middleware) Record(method, route string, status int, duration time.Duration) {
	ctx := context.Background()
	labels := RequestLabels{
		Method: method,
		Route:  route,
		Status: status,
	}
	RecordRequest(ctx, labels, float64(duration.Milliseconds()))
}

func GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		route := c.FullPath()
		if route == "" {
			route = "unknown"
		}

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method

		RecordRequest(c.Request.Context(), RequestLabels{
			Method: method,
			Route:  route,
			Status: status,
		}, float64(duration.Milliseconds()))
	}
}
