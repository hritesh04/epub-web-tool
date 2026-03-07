package consumer

import (
	"context"
	"encoding/json"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/queue"
	rmq "github.com/rabbitmq/rabbitmq-amqp-go-client/pkg/rabbitmqamqp"
)

type RabbitMQTranslationReqConsumer struct {
	consumer *rmq.Consumer
	cfg config.Queue
}

func NewTranslationReqConsumer(cfg config.Queue) *RabbitMQTranslationReqConsumer {
	ctx,cancel := context.WithTimeout(context.Background(),time.Second*10)
	defer cancel()
	conn,err := rmq.Dial(ctx,cfg.URI(),nil)
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to rabbitmq")
	}
	management := conn.Management()
	_, err = management.DeclareQueue(ctx, &rmq.QuorumQueueSpecification{
			Name: cfg.ChunkerQueue,
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Error declaring queue")
	}
	consumer,err := conn.NewConsumer(ctx,cfg.ChunkerQueue,nil)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating publisher")
	}
	return &RabbitMQTranslationReqConsumer{
		consumer:consumer,
		cfg: cfg,
	}
}

func (r *RabbitMQTranslationReqConsumer) Consume(ctx context.Context)(rmq.IDeliveryContext,queue.TranslationMsg,error){
	var msg queue.TranslationMsg
	item, err := r.consumer.Receive(ctx)
	if err != nil {
		return item,msg,err
	}
	if err := json.Unmarshal(item.Message().GetData(),&msg);err != nil {
		log.Error().Err(err).Msg("Error unmarshalling queue msg")
		return item,msg,err
	}
	return item,msg,nil
}