package consumer

import (
	"context"
	"encoding/json"

	"github.com/rs/zerolog/log"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/queue"
	rmq "github.com/rabbitmq/rabbitmq-amqp-go-client/pkg/rabbitmqamqp"
)

type RabbitMQZipReqConsumer struct {
	consumer *rmq.Consumer
	cfg config.Queue
}

func NewRabbitMQZipReqConsumer(cfg config.Queue) *RabbitMQZipReqConsumer {
	ctx := context.Background()
	conn,err := rmq.Dial(ctx,cfg.URI(),nil)
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to rabbitmq")
	}
	management := conn.Management()
	_, err = management.DeclareQueue(ctx, &rmq.QuorumQueueSpecification{
			Name: cfg.ZipQueue,
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Error declaring queue")
	}
	consumer,err := conn.NewConsumer(ctx,cfg.ZipQueue,nil)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating publisher")
	}
	return &RabbitMQZipReqConsumer{
		consumer:consumer,
		cfg: cfg,
	}
}

func (r *RabbitMQZipReqConsumer) Consume(ctx context.Context)(rmq.IDeliveryContext,queue.CompilationMsg,error){
	var msg queue.CompilationMsg
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