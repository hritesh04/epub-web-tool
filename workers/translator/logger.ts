import type { Span } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import pino from "pino";

// Resolved lazily so the OTel logger provider (registered in initTelemetry)
// is available before the first log record is emitted.
function otelLogger() {
  return logs.getLogger("epub-web-tool-translator");
}

const SEVERITY: Record<number, { text: string; number: SeverityNumber }> = {
  10: { text: "trace", number: SeverityNumber.TRACE },
  20: { text: "debug", number: SeverityNumber.DEBUG },
  30: { text: "info", number: SeverityNumber.INFO },
  40: { text: "warn", number: SeverityNumber.WARN },
  50: { text: "error", number: SeverityNumber.ERROR },
  60: { text: "fatal", number: SeverityNumber.FATAL },
};

// Bridges pino records to the OpenTelemetry logs API, which the SDK forwards
// to OpenObserve via OTLP.
function otelDestination(): pino.DestinationStream {
  return {
    write(line: string) {
      try {
        const data = JSON.parse(line);
        const severity = SEVERITY[data.level as number] ?? SEVERITY[30];

        const attributes: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(data)) {
          if (["level", "time", "msg", "hostname", "pid"].includes(key)) continue;
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            attributes[key] = value;
          }
        }

        otelLogger().emit({
          body: typeof data.msg === "string" ? data.msg : JSON.stringify(data.msg),
          severityText: severity.text,
          severityNumber: severity.number,
          timestamp: typeof data.time === "number" ? data.time : Date.now(),
          attributes,
        });
      } catch {
        // Never let the logging bridge break the worker.
      }
    },
  };
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    { stream: process.stdout },
    { stream: otelDestination() },
  ]),
);

// Returns a logger whose trace_id/span_id fields are bound to the active span,
// so logs correlate with traces in OpenObserve.
export function withSpan(span?: Span) {
  if (!span) return logger;
  const sc = span.spanContext();
  return logger.child({ trace_id: sc.traceId, span_id: sc.spanId });
}
