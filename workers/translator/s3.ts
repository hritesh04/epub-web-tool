import { PutObjectCommand, S3, S3Client } from "@aws-sdk/client-s3";
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
    async uploadTranslatedChunk(requestID:string,path:string,data:string){
        try{
            const key = requestID+"/"+path
            const cmd = new PutObjectCommand({Bucket:this.cfg.translationBucket,Key:key,Body:data})
            await this.client.send(cmd)
        }catch(err:any){
            console.log("Error uploading translated chunks:",err)
        }
    }
}