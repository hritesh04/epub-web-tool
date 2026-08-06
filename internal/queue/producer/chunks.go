package producer

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/otel"
	"github.com/hritesh04/epub-web-tool/internal/queue"
	rmq "github.com/rabbitmq/rabbitmq-amqp-go-client/pkg/rabbitmqamqp"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type RabbitMQChunkPublisher struct {
	publisher *rmq.Publisher
	cfg config.Queue
}

func NewChunkPublisher(cfg config.Queue) *RabbitMQChunkPublisher {
	ctx,cancel := context.WithTimeout(context.Background(),time.Second*10)
	defer cancel()
	conn,err := rmq.Dial(ctx,cfg.URI(),nil)
	if err != nil {
		log.Fatal("Error connecting to rabbitmq:",err)
	}
	management := conn.Management()
	_, err = management.DeclareQueue(ctx, &rmq.QuorumQueueSpecification{
			Name: cfg.ChunkerQueue,
	})
	if err != nil {
		log.Fatal("Error declaring chunker queue:",err)
	}
	_, err = management.DeclareQueue(ctx, &rmq.QuorumQueueSpecification{
			Name: cfg.TranslationQueue,
	})
	if err != nil {
		log.Fatal("Error declaring translation queue:",err)
	}
	_, err = management.DeclareQueue(ctx, &rmq.QuorumQueueSpecification{
		Name: cfg.ZipQueue,
})
if err != nil {
	log.Fatal("Error declaring translation queue:",err)
}
	publisher,err := conn.NewPublisher(ctx,nil,nil)
	if err != nil {
		log.Fatal("Error creating publisher:",err)
	}
	return &RabbitMQChunkPublisher{
		publisher:publisher,
		cfg: cfg,
	}
}

func (r *RabbitMQChunkPublisher) PublishFileChunks(ctx context.Context, data []queue.ChunkMsg) error {
	for i := range data {
		item := &data[i]
		ctx, span := otel.Tracer("queue.producer").Start(ctx, "queue.publish",
			trace.WithSpanKind(trace.SpanKindProducer),
			trace.WithAttributes(
				attribute.String("messaging.system", "rabbitmq"),
				attribute.String("messaging.operation", "publish"),
				attribute.String("messaging.destination", r.cfg.TranslationQueue),
				attribute.String("epub.id", item.EpubID),
				attribute.Int("chunk.id", item.ChunkID),
			))

		queue.SetTraceContext(ctx, item)

		dataByte, err := json.Marshal(item)
		if err != nil {
			otel.RecordError(ctx, err)
			span.End()
			return err
		}
		msg, err := rmq.NewMessageWithAddress(
			[]byte(dataByte),
			&rmq.QueueAddress{
				Queue: r.cfg.TranslationQueue,
			},
		)
		if err != nil {
			otel.RecordError(ctx, err)
			span.End()
			return err
		}

		_, err = r.publisher.Publish(ctx, msg)
		if err != nil {
			otel.RecordError(ctx, err)
			span.End()
			return err
		}
		otel.RecordQueuePublished(ctx, r.cfg.TranslationQueue,
			attribute.String("epub.id", item.EpubID),
			attribute.Int("chunk.id", item.ChunkID),
		)
		span.End()
	}
	return nil
}