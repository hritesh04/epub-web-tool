import amqplib from "amqplib";
import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { loadConfig } from "./config";
import { DB } from "./db";
import { logger, withSpan } from "./logger";
import { S3Service } from "./s3";
import {
  encodeTraceContext,
  extractParentContext,
  initTelemetry,
} from "./tracing";
import { translateHTML, translateNCX } from "./translation";

export type chunkMsg = {
  epubID: string;
  count: number;
  chunkID: number;
  translateTo: string;
  traceparent?: string;
  tracestate?: string;
};

const tracer = trace.getTracer("translator");

async function main() {
  try {
    const cfg = loadConfig();
    initTelemetry(cfg.openobserve);

    const db = new DB(cfg.DB.url);
    await db.connect();
    const s3 = new S3Service(cfg.s3);
    const conn = await amqplib.connect(
      `amqp://${cfg.queue.user}:${cfg.queue.passeword}@${cfg.queue.host}`
    );
    const ch = await conn.createChannel();
    await ch.prefetch(1);
    await ch.consume(cfg.queue.translationQueue, async (msg) => {
      if (msg === null) {
        logger.warn("Consumer cancelled by server");
        return;
      }
      const data: chunkMsg = JSON.parse(msg.content.toString());

      // Rebuild the W3C trace context that the chunker embedded in the
      // message body and start this worker's consumer span under it.
      const parentCtx = extractParentContext(data);
      const consumerSpan = tracer.startSpan(
        "translation.consume",
        {
          kind: SpanKind.CONSUMER,
          attributes: {
            "messaging.system": "rabbitmq",
            "messaging.operation": "process",
            "epub.id": data.epubID,
            "chunk.id": data.chunkID,
          },
        },
        parentCtx
      );
      const spanCtx = trace.setSpan(parentCtx, consumerSpan);
      const log = withSpan(consumerSpan);

      try {
        log.info(
          { epubID: data.epubID, chunkID: data.chunkID },
          "Translation task for epub"
        );

        const statusSpan = tracer.startSpan(
          "db.already_translated",
          undefined,
          spanCtx
        );
        const { chunk_count } = await db.alreadyTranslated(
          String(data.chunkID),
          data.epubID
        );
        statusSpan.end();
        if (chunk_count === -1) {
          log.info(
            { epubID: data.epubID, chunkID: data.chunkID },
            "Already translated"
          );
          ch.ack(msg);
          return;
        }

        const partsSpan = tracer.startSpan(
          "db.chunk_parts",
          undefined,
          spanCtx
        );
        const chunk = await db.getChunkParts(String(data.chunkID), data.epubID);
        partsSpan.end();

        if (chunk.length === 0) {
          log.info({ chunkID: data.chunkID }, "Chunks length is 0");
          if (data.chunkID === chunk_count) {
            log.info("Last chunk sending to zip queue");
            const ch2 = await conn.createChannel();
            const zipBody = {
              epubID: data.epubID,
              ...encodeTraceContext(spanCtx, {}),
            };
            ch2.sendToQueue(
              cfg.queue.zipQueue,
              Buffer.from(JSON.stringify(zipBody))
            );
          }
          return;
        }

        log.info({ count: chunk.length }, "Total untranslated chunks");

        let counter = 0;

        for (const { object_key } of chunk) {
          const objSpan = tracer.startSpan(
            "translation.object",
            {
              kind: SpanKind.CLIENT,
              attributes: {
                "epub.id": data.epubID,
                "chunk.id": data.chunkID,
                "s3.key": object_key,
              },
            },
            spanCtx
          );
          const objCtx = trace.setSpan(spanCtx, objSpan);

          try {
            log.info({ key: object_key }, "Translating path");

            const dlSpan = tracer.startSpan(
              "s3.download",
              {
                kind: SpanKind.CLIENT,
                attributes: { "s3.key": object_key },
              },
              objCtx
            );
            const objectData = await s3.downloadChunkObject(object_key);
            dlSpan.end();

            if (!objectData) {
              log.warn({ key: object_key }, "object not found");
              db.updateChunkStatus(
                data.epubID,
                String(data.chunkID),
                "failed",
                "object not found"
              );
              ch.nack(msg);
              continue;
            }

            let translatedText;
            const trSpan = tracer.startSpan(
              object_key.endsWith("html")
                ? "translation.html"
                : "translation.ncx",
              { attributes: { "s3.key": object_key } },
              objCtx
            );
            if (object_key.endsWith("html")) {
              translatedText = await translateHTML(object_key, objectData);
            } else {
              translatedText = await translateNCX(objectData);
            }
            trSpan.end();

            const upSpan = tracer.startSpan(
              "s3.upload",
              {
                kind: SpanKind.CLIENT,
                attributes: { "s3.key": object_key },
              },
              objCtx
            );
            await s3.uploadTranslatedChunk(object_key, translatedText);
            upSpan.end();

            log.info({ key: object_key }, "successfully translated");
            const updSpan = tracer.startSpan(
              "db.status_update",
              undefined,
              objCtx
            );
            await db.updateChunkStatus(
              data.epubID,
              String(data.chunkID),
              "completed",
              ""
            );
            updSpan.end();
            counter++;
          } catch (err: any) {
            objSpan.recordException(err);
            objSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: err?.message,
            });
            log.error(
              { err, key: object_key },
              `Error translating epub ${data.epubID} chunk ${data.chunkID}: ${err.message}`
            );
            db.updateChunkStatus(
              data.epubID,
              String(data.chunkID),
              "failed",
              err.message
            );
            ch.nack(msg);
            continue;
          } finally {
            objSpan.end();
          }
        }
        if (counter == data.count) {
          ch.ack(msg);
        }
        log.info(
          { chunkID: data.chunkID, totalChunks: chunk_count },
          "checking for last chunk"
        );
        if (data.chunkID === chunk_count) {
          log.info("Last chunk sending to zip queue");
          const ch2 = await conn.createChannel();
          const zipBody = {
            epubID: data.epubID,
            ...encodeTraceContext(spanCtx, {}),
          };
          ch2.sendToQueue(
            cfg.queue.zipQueue,
            Buffer.from(JSON.stringify(zipBody))
          );
        }
      } catch (err: any) {
        consumerSpan.recordException(err);
        consumerSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: err?.message,
        });
        log.error({ err }, `Error processing chunk: ${err.message}`);
      } finally {
        consumerSpan.end();
      }
    });
    return;
  } catch (err: any) {
    logger.error({ err }, `Error consuming msg: ${err.message}`);
    return err;
  }
}

main().catch((err) => logger.error({ err }, "Fatal error"));
