package consumer

import (
	"context"
	"encoding/json"
	"log"

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
		log.Fatal("Error connecting to rabbitmq:",err)
	}
	management := conn.Management()
	_, err = management.DeclareQueue(ctx, &rmq.QuorumQueueSpecification{
			Name: cfg.ZipQueue,
	})
	if err != nil {
		log.Fatal("Error declaring queue:",err)
	}
	consumer,err := conn.NewConsumer(ctx,cfg.ZipQueue,nil)
	if err != nil {
		log.Fatal("Error creating publisher:",err)
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
		log.Println("Error unmarshalling queue msg:",err)
		return item,msg,err
	}
	return item,msg,nil
}