import amqplib from "amqplib";
import { loadConfig } from "./config";
import { translate } from "./translation";
import { S3Service } from "./s3";

export type chunkMsg = {
    count: number;
    path: string[];
    requestID: string;
    content: Record<string, string>
}

async function main(){
    try{
        const cfg = loadConfig()
        const s3 = new S3Service(cfg.s3)
        const conn = await amqplib.connect(`amqp://${cfg.queue.user}:${cfg.queue.passeword}@${cfg.queue.host}`)
        const ch = await conn.createChannel()
        await ch.prefetch(1);
        await ch.consume(cfg.queue.translationQueue, async (msg)=>{
            if (msg === null) {
                console.log('Consumer cancelled by server');
                return
            }
            const failedChunk:chunkMsg={
                count:0,
                path:[],
                requestID:"",
                content:{}
            };
            const data:chunkMsg = JSON.parse(msg.content.toString())
            for (const key of Object.keys(data.content)) {
                try {
                    console.log("Translating path:", key);
                    const translatedText = await translate(key, data.content[key]);
                    await s3.uploadTranslatedChunk(data.requestID,key,translatedText);
                    console.log("successfully translated:", key);
                } catch (err: any) {
                    console.log(`Error translating path ${key} with error: ${err.message}`);
                    failedChunk.path.push(key);
                    failedChunk.content[key] = data.content[key];
                    failedChunk.requestID=data.requestID
                    failedChunk.count++;
                }
            }
            
            if(failedChunk.count!=0){
                console.log("failed translation chunk detected requeued:",failedChunk.count,"chunks")
                ch.sendToQueue(cfg.queue.translationQueue,Buffer.from(JSON.stringify(failedChunk)))
            }
            
            ch.ack(msg);
        })
        console.log("DONE")
        return
    }catch(err:any){
        console.log("Error consuming msg:",err.message)
        return err
    }
}

main().catch(err=>console.error(err))