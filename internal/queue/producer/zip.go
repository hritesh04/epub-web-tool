package producer

import (
	"context"
	"encoding/json"
	"log"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/queue"
	rmq "github.com/rabbitmq/rabbitmq-amqp-go-client/pkg/rabbitmqamqp"
)

type RabbitMQZipReqPublisher struct {
	publisher *rmq.Publisher
	cfg config.Queue
}

func NewZipRequestPublisher(cfg config.Queue) *RabbitMQZipReqPublisher {
	ctx := context.Background()
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
	return &RabbitMQZipReqPublisher{
		publisher:publisher,
		cfg: cfg,
	}
}

func (r *RabbitMQZipReqPublisher) PublishZipReq(ctx context.Context,data queue.TranslationMsg)error{
	dataByte, err := json.Marshal(data)
	if err != nil {
		log.Println("Error marshalling message:",err)
		return err
	}
	msg, err := rmq.NewMessageWithAddress(
		[]byte(dataByte),
		&rmq.QueueAddress{
			Queue: r.cfg.ZipQueue,
		},
	)
	if err != nil {
		log.Println("Error creating message for queue:",err)
	}
	_,err = r.publisher.Publish(ctx,msg)
	if err != nil {
		log.Println("Error publishing message to queue:",err)
		return err
	}
	return nil
}