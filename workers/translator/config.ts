import dotenv from "dotenv";
dotenv.config()

export type s3Config = {
    endpoint: string;
    key: string;
    password:string;
    region:string;
    translationBucket:string;
    chunkBucket:string;
}

export type queueConfig = {
    host: string;
    user: string;
    passeword:string;
    translationQueue:string;
    zipQueue:string;    
}

export type DBConfig = {
    url:string;
}

export type config = {
    DB: DBConfig
    s3 : s3Config
    queue : queueConfig
}

export function loadConfig():config{
    
    const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/epub"

    const queueHost = process.env.QUEUE_HOST || "localhost:5672"
    const queueUser = process.env.QUEUE_USER || "user"
    const queuePasseword = process.env.QUEUE_PASSWORD || "password"
    const queueTranslation = process.env.QUEUE_TRANSLATION || "translation"
    const queueZip = process.env.QUEUE_ZIP || "zip"
    
    const s3Endpoint = process.env.S3_ENDPOINT || "http://localhost:9000"
    const s3Key = process.env.S3_KEY || "minioadmin"
    const s3Password = process.env.S3_PASSWORD || "minioadmin" 
    const s3Region = process.env.S3_REGION || "us-west-2"
    const s3TranslationBucket= process.env.S3_TRANSLATED_BUCKET || "translations"
    const s3ChunkBucket= process.env.S3_CHUNK_BUCKET || "chunks"

    return {
        DB:{
            url:dbUrl
        },
        s3:{
            endpoint:s3Endpoint,
            key:s3Key,
            password:s3Password,
            region:s3Region,
            translationBucket:s3TranslationBucket,
            chunkBucket:s3ChunkBucket
        },
        queue:{
            host:queueHost,
            user:queueUser,
            passeword:queuePasseword,
            translationQueue:queueTranslation,
            zipQueue:queueZip
        }
    }
}