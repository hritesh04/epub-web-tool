package consumer

import (
	"context"
	"encoding/json"
	"log"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/queue"
	rmq "github.com/rabbitmq/rabbitmq-amqp-go-client/pkg/rabbitmqamqp"
)

type RabbitMQTranslationReqConsumer struct {
	consumer *rmq.Consumer
	cfg config.Queue
}

func NewTranslationReqConsumer(cfg config.Queue) *RabbitMQTranslationReqConsumer {
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
		log.Fatal("Error declaring queue:",err)
	}
	consumer,err := conn.NewConsumer(ctx,cfg.ChunkerQueue,nil)
	if err != nil {
		log.Fatal("Error creating publisher:",err)
	}
	return &RabbitMQTranslationReqConsumer{
		consumer:consumer,
		cfg: cfg,
	}
}

func (r *RabbitMQTranslationReqConsumer) Consume(ctx context.Context)(queue.TranslationMsg,error){
	var msg queue.TranslationMsg
	item, err := r.consumer.Receive(ctx)
	if err != nil {
		return msg,err
	}
	if err := json.Unmarshal(item.Message().GetData(),&msg);err != nil {
		log.Println("Error unmarshalling queue msg:",err)
		return msg,err
	}
	return msg,nil
}