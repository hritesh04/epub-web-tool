package otel

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

var (
	currentServiceName       string
	httpServerRequestCount   metric.Int64Counter
	httpServerRequestDuration metric.Float64Histogram
	httpServerErrors         metric.Int64Counter
	httpServerActiveRequests metric.Int64UpDownCounter
	uploadsCounter           metric.Int64Counter
	queueConsumedCounter     metric.Int64Counter
	queuePublishedCounter    metric.Int64Counter
	epubPipelineDuration     metric.Float64Histogram
	s3OperationCounter       metric.Int64Counter
	s3OperationDuration      metric.Float64Histogram
	dbQueryCounter           metric.Int64Counter
	dbQueryDuration          metric.Float64Histogram
)

func InitMetrics(serviceName string) error {
	currentServiceName = serviceName
	meter := otel.Meter("epub-web-tool")

	var err error

	httpServerRequestCount, err = meter.Int64Counter(
		"http.server.request.count",
		metric.WithDescription("Total number of HTTP requests received"),
	)
	if err != nil {
		return err
	}

	httpServerRequestDuration, err = meter.Float64Histogram(
		"http.server.request.duration",
		metric.WithDescription("HTTP request duration in seconds"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return err
	}

	httpServerErrors, err = meter.Int64Counter(
		"http.server.request.errors",
		metric.WithDescription("Total number of HTTP requests that returned an error status"),
	)
	if err != nil {
		return err
	}

	httpServerActiveRequests, err = meter.Int64UpDownCounter(
		"http.server.active_requests",
		metric.WithDescription("Number of in-flight HTTP requests"),
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

	queueConsumedCounter, err = meter.Int64Counter(
		"queue.messages.consumed",
		metric.WithDescription("Total number of messages consumed from queues"),
	)
	if err != nil {
		return err
	}

	queuePublishedCounter, err = meter.Int64Counter(
		"queue.messages.published",
		metric.WithDescription("Total number of messages published to queues"),
	)
	if err != nil {
		return err
	}

	epubPipelineDuration, err = meter.Float64Histogram(
		"epub.pipeline.duration",
		metric.WithDescription("Duration of a pipeline stage in seconds"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return err
	}

	s3OperationCounter, err = meter.Int64Counter(
		"s3.operations",
		metric.WithDescription("Total number of S3 operations"),
	)
	if err != nil {
		return err
	}

	s3OperationDuration, err = meter.Float64Histogram(
		"s3.operation.duration",
		metric.WithDescription("Duration of S3 operations in seconds"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return err
	}

	dbQueryCounter, err = meter.Int64Counter(
		"db.queries",
		metric.WithDescription("Total number of database queries"),
	)
	if err != nil {
		return err
	}

	dbQueryDuration, err = meter.Float64Histogram(
		"db.query.duration",
		metric.WithDescription("Duration of database queries in seconds"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return err
	}

	return nil
}

type RequestLabels struct {
	Method    string
	Route     string
	RequestID string
	Status    int
}

func RecordRequest(ctx context.Context, labels RequestLabels, duration float64) {
	attrs := []attribute.KeyValue{
		attribute.String("service_name", currentServiceName),
		attribute.String("http.request.method", labels.Method),
		attribute.String("http.route", labels.Route),
		attribute.String("http.request_id", labels.RequestID),
		attribute.Int("http.response.status_code", labels.Status),
	}

	httpServerRequestCount.Add(ctx, 1, metric.WithAttributes(attrs...))
	httpServerRequestDuration.Record(ctx, duration, metric.WithAttributes(attrs...))

	if labels.Status >= 400 {
		httpServerErrors.Add(ctx, 1, metric.WithAttributes(attrs...))
	}
}

func RecordUpload(ctx context.Context, attrs ...attribute.KeyValue) {
	uploadsCounter.Add(ctx, 1, metric.WithAttributes(attrs...))
}

func RecordQueueConsumed(ctx context.Context, queue string, attrs ...attribute.KeyValue) {
	a := append([]attribute.KeyValue{attribute.String("queue_name", queue)}, attrs...)
	queueConsumedCounter.Add(ctx, 1, metric.WithAttributes(a...))
}

func RecordQueuePublished(ctx context.Context, queue string, attrs ...attribute.KeyValue) {
	a := append([]attribute.KeyValue{attribute.String("queue_name", queue)}, attrs...)
	queuePublishedCounter.Add(ctx, 1, metric.WithAttributes(a...))
}

func RecordPipelineDuration(ctx context.Context, service, stage string, duration float64, attrs ...attribute.KeyValue) {
	a := append([]attribute.KeyValue{
		attribute.String("service_name", service),
		attribute.String("stage", stage),
	}, attrs...)
	epubPipelineDuration.Record(ctx, duration, metric.WithAttributes(a...))
}

func RecordS3Operation(ctx context.Context, operation string, duration float64, attrs ...attribute.KeyValue) {
	a := append([]attribute.KeyValue{attribute.String("operation", operation)}, attrs...)
	s3OperationCounter.Add(ctx, 1, metric.WithAttributes(a...))
	s3OperationDuration.Record(ctx, duration, metric.WithAttributes(a...))
}

func RecordDBQuery(ctx context.Context, operation string, duration float64, err error) {
	attrs := []attribute.KeyValue{
		attribute.String("service_name", currentServiceName),
		attribute.String("operation", operation),
		attribute.Bool("error", err != nil),
	}
	dbQueryCounter.Add(ctx, 1, metric.WithAttributes(attrs...))
	dbQueryDuration.Record(ctx, duration, metric.WithAttributes(attrs...))
}

func IncActiveRequests(ctx context.Context) {
	httpServerActiveRequests.Add(ctx, 1, metric.WithAttributes(attribute.String("service_name", currentServiceName)))
}

func DecActiveRequests(ctx context.Context) {
	httpServerActiveRequests.Add(ctx, -1, metric.WithAttributes(attribute.String("service_name", currentServiceName)))
}

func GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		route := c.FullPath()
		if route == "" {
			route = "unknown"
		}
		IncActiveRequests(c.Request.Context())
		defer DecActiveRequests(c.Request.Context())
		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method
		requestID := c.GetString("requestID")
		if requestID == "" {
			requestID = "unknown"
		}

		if span := trace.SpanFromContext(c.Request.Context()); span.SpanContext().IsValid() {
			span.SetAttributes(
				attribute.String("http.request_id", requestID),
				attribute.String("http.route", route),
			)
		}

		RecordRequest(c.Request.Context(), RequestLabels{
			Method:    method,
			Route:     route,
			Status:    status,
			RequestID: requestID,
		}, duration.Seconds())
	}
}
