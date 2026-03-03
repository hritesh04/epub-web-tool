import { GetObjectCommand, PutObjectCommand, S3, S3Client } from "@aws-sdk/client-s3";
import {  s3Config } from "./config";

export class S3Service {
    client:S3Client
    cfg:s3Config
    constructor(cfg:s3Config){
        this.cfg=cfg
        this.client = new S3Client({
            endpoint:cfg.endpoint,
            region:cfg.region,
            forcePathStyle:true,
            credentials: {
                accessKeyId:cfg.key,
                secretAccessKey:cfg.password
            }
        })
    }
    async uploadTranslatedChunk(key:string,data:string){
        try{
            const cmd = new PutObjectCommand({Bucket:this.cfg.translationBucket,Key:key,Body:data})
            await this.client.send(cmd)
        }catch(err:any){
            console.log("Error uploading translated chunks:",err)
        }
    }
    async downloadChunkObject(key:string):Promise<string | undefined>{
        try{
            const cmd = new GetObjectCommand({Bucket:this.cfg.chunkBucket,Key:key})
            const res = await this.client.send(cmd)
            return res.Body?.transformToString()
        }catch(err:any){
            console.log("Error downloading translated chunks:",err)
        }
    }
}