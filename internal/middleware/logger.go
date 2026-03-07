package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/trace"
)

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		end := time.Now()
		latency := end.Sub(start)

		if raw != "" {
			path = path + "?" + raw
		}

		clientIP := c.ClientIP()
		method := c.Request.Method
		requestID := c.GetString("requestID")

		// Extract OTel TraceID and SpanID
		span := trace.SpanFromContext(c.Request.Context())
		traceID := span.SpanContext().TraceID().String()
		spanID := span.SpanContext().SpanID().String()
		statusCode := c.Writer.Status()
		errorMessage := c.Errors.ByType(gin.ErrorTypePrivate).String()

		bodySize := c.Writer.Size()

		if errorMessage != "" {
			log.Error().
				Str("client_ip", clientIP).
				Str("method", method).
				Str("request_id",requestID).
				Str("trace_id", traceID).
				Str("span_id", spanID).
				Int("status_code", statusCode).
				Int("body_size", bodySize).
				Str("path", path).
				Str("latency", latency.String()).
				Str("error", errorMessage).
				Msg("HTTP Request Error")
		} else {
			log.Info().
				Str("client_ip", clientIP).
				Str("method", method).
				Str("request_id",requestID).
				Str("trace_id", traceID).
				Str("span_id", spanID).
				Int("status_code", statusCode).
				Int("body_size", bodySize).
				Str("path", path).
				Str("latency", latency.String()).
				Msg("HTTP Request")
		}
	}
}
