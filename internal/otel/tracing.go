package otel

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

func Tracer(name string) trace.Tracer {
	return otel.Tracer(name)
}

// EncodeTraceParent serializes the W3C trace context (traceparent/tracestate)
// from the active span in ctx. Returns empty strings when there is no valid span.
func EncodeTraceParent(ctx context.Context) (traceparent string, tracestate string) {
	span := trace.SpanFromContext(ctx)
	if !span.SpanContext().IsValid() {
		return "", ""
	}
	carrier := &traceCarrier{}
	otel.GetTextMapPropagator().Inject(ctx, carrier)
	return carrier.Get("traceparent"), carrier.Get("tracestate")
}

// ContextFromTraceParent rebuilds a parent context from a serialized W3C
// traceparent/tracestate. The returned context carries no active span; callers
// use it as the parent of a new consumer span.
func ContextFromTraceParent(ctx context.Context, traceparent string, tracestate string) context.Context {
	if traceparent == "" {
		return ctx
	}
	return otel.GetTextMapPropagator().Extract(ctx, &traceCarrier{
		traceparent: traceparent,
		tracestate:  tracestate,
	})
}

type traceCarrier struct {
	traceparent string
	tracestate  string
}

func (c *traceCarrier) Get(key string) string {
	switch key {
	case "traceparent":
		return c.traceparent
	case "tracestate":
		return c.tracestate
	}
	return ""
}

func (c *traceCarrier) Set(key, value string) {
	switch key {
	case "traceparent":
		c.traceparent = value
	case "tracestate":
		c.tracestate = value
	}
}

func (c *traceCarrier) Keys() []string {
	keys := make([]string, 0, 2)
	if c.traceparent != "" {
		keys = append(keys, "traceparent")
	}
	if c.tracestate != "" {
		keys = append(keys, "tracestate")
	}
	return keys
}

func SetSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
		span.SetAttributes(attrs...)
	}
}

func RecordError(ctx context.Context, err error) {
	if err != nil {
		trace.SpanFromContext(ctx).RecordError(err)
	}
}

var (
	_ propagation.TextMapCarrier = (*traceCarrier)(nil)
)
