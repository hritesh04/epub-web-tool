import type { Context } from "@opentelemetry/api";
import { context, propagation } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  BasicTracerProvider,
  TracerConfig,
} from "@opentelemetry/sdk-trace-base";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";

export type OpenObserveConfig = {
  endpoint: string;
  organization: string;
  authToken: string;
};

export type TraceContext = {
  traceparent?: string;
  tracestate?: string;
};

let tracerProvider: BasicTracerProvider | undefined;
let loggerProvider: LoggerProvider | undefined;

// Initializes the OTel tracer and logger providers, exporting both to
// OpenObserve via OTLP/HTTP. Must be called before any logging occurs.
export function initTelemetry(cfg: OpenObserveConfig) {
  const resource = new Resource({
    ["service.name"]: "epub-web-tool-translator",
  });

  const spanProcessor = new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: `http://${cfg.endpoint}/api/${cfg.organization}/v1/traces`,
      headers: {
        Authorization: `Basic ${cfg.authToken}`,
      },
    })
  );

  tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [spanProcessor],
  });

  tracerProvider.register();
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `http://${cfg.endpoint}/api/${cfg.organization}/v1/logs`,
        headers: { Authorization: `Basic ${cfg.authToken}` },
      })
    )
  );
  logs.setGlobalLoggerProvider(loggerProvider);

  return {
    shutdown: async () => {
      await tracerProvider?.shutdown();
      await loggerProvider?.shutdown();
    },
  };
}

// TraceParentCarrier lets the W3C propagator read/write the trace context that
// travels inside the queue message JSON body.
export class TraceParentCarrier {
  constructor(private readonly traceContext: TraceContext) {}

  get(key: string): string | undefined {
    switch (key) {
      case "traceparent":
        return this.traceContext.traceparent;
      case "tracestate":
        return this.traceContext.tracestate;
      default:
        return undefined;
    }
  }

  set(key: string, value: string): void {
    switch (key) {
      case "traceparent":
        this.traceContext.traceparent = value;
        break;
      case "tracestate":
        this.traceContext.tracestate = value;
        break;
    }
  }

  keys(): string[] {
    return Object.keys(this.traceContext);
  }
}

// extractParentContext rebuilds a remote parent context from the serialized
// W3C trace context embedded in a queue message.
export function extractParentContext(traceContext: TraceContext): Context {
  return propagation.extract(
    context.active(),
    new TraceParentCarrier(traceContext)
  );
}

// encodeTraceContext writes the trace context of ctx into the carrier-backed
// object and returns it, so it can travel in the queue message body.
export function encodeTraceContext(
  ctx: Context,
  traceContext: TraceContext
): TraceContext {
  propagation.inject(ctx, new TraceParentCarrier(traceContext));
  return traceContext;
}
