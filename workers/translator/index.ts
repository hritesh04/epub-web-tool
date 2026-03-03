import amqplib from "amqplib";
import { loadConfig } from "./config";
import { translate } from "./translation";
import { S3Service } from "./s3";
import { DB } from "./db";
import fs from "fs/promises"
import { join } from "path";
import { tmpdir } from "os";

export type chunkMsg = {
    epubID: string;
    count: number;
    chunkID: string;
    translateTo: string;
}

async function main(){
    try{
        const cfg = loadConfig()
        const db = new DB(cfg.DB.url)
        await db.connect()
        const s3 = new S3Service(cfg.s3)
        const conn = await amqplib.connect(`amqp://${cfg.queue.user}:${cfg.queue.passeword}@${cfg.queue.host}`)
        const ch = await conn.createChannel()
        await ch.prefetch(1);
        await ch.consume(cfg.queue.translationQueue, async (msg)=>{
            if (msg === null) {
                console.log('Consumer cancelled by server');
                return
            }
            const data:chunkMsg = JSON.parse(msg.content.toString())
            console.log("Translation task for epub:",data.epubID,"chunk",data.chunkID)
            const {chunk_count} = await db.alreadyTranslated(data.chunkID,data.epubID)
            if(chunk_count === -1){
                console.log("Already translated:",data.epubID,"chunk:",data.chunkID)
                ch.ack(msg)
                return
            }
            
            const chunk = await db.getChunkParts(data.chunkID,data.epubID)
            
            if (chunk.length === 0){
                console.log("Chunks length is 0")
                if (data.chunkID===chunk_count){
                    console.log("Last chunk sending to zip queue")
                    const ch2 = await conn.createChannel();
                    ch2.sendToQueue(cfg.queue.zipQueue,Buffer.from(`{"epubID":${data.epubID}}`))
                }
                return
            }

            console.log("Total untranslated chunks:",chunk.length)

            let counter = 0
            
            for (const {object_key} of chunk){
                try{
                    console.log("Translating path:",object_key)
                    const objectData = await s3.downloadChunkObject(object_key)
                    if(!objectData){
                        console.log("object not found")
                        db.updateChunkStatus(data.epubID,data.chunkID,'failed','object not found')
                        continue
                    }
                    const translatedText = await translate(object_key,objectData);
                    await s3.uploadTranslatedChunk(object_key,translatedText)
                    console.log("successfully translated:", object_key);
                    await db.updateChunkStatus(data.epubID,data.chunkID,'completed','')
                    counter++
                }catch(err:any){
                    console.log(`Error translating epub ${data.epubID} chunk ${data.chunkID} with error: ${err.message}`);
                    db.updateChunkStatus(data.epubID,data.chunkID,'failed',err.message)
                }
            }
            if (counter == data.count) {
                ch.ack(msg);
            }
            console.log("checking for last chunk, chunkID:",data.chunkID,"total chunks:",chunk_count)
            if (data.chunkID === chunk_count){
                console.log("Last chunk sending to zip queue")
                const ch2 = await conn.createChannel();
                ch2.sendToQueue(cfg.queue.zipQueue,Buffer.from(`{"epubID":"${data.epubID}"}`))
            }
        })
        return
    }catch(err:any){
        console.log("Error consuming msg:",err.message)
        return err
    }
}

main().catch(err=>console.error(err))