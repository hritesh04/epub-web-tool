import { Client, Pool } from "pg"

export class DB {
  private client: Pool
  private url:string
  constructor(url: string) {
    this.client = new Pool({ connectionString: url })
    this.url=url
  }

  async connect(){
    if(!this.client) this.client = new Pool({ connectionString: this.url })
    await this.client.connect()
  }
  
  async alreadyTranslated(chunkID:string,epubID:string){
    try{
      const result = await this.client.query("UPDATE chunks SET status='processing', updated_at=now() WHERE chunk_id=$1 AND epub_id=$2 AND ( status='queued' OR (status='processing' AND updated_at < now() - interval '5 minutes')) RETURNING chunk_id;",[chunkID,epubID])
      if (result.rowCount == 0) {
        return {chunk_count:-1}
      }
      const row = await this.client.query("SELECT chunk_count FROM epubs WHERE id=$1",[epubID])
      if (row.rowCount==0){
        return {chunk_count:-1}
      }
      console.log(row.rows)
      return row.rows[0]
    }catch(err:any){
      console.log("Error checking if chunk already translated:",err.message)
    }
  }

  async getChunkParts(chunkID:string,epubID:string):Promise<{object_key:string}[]>{
    try{
      const result = await this.client.query("SELECT object_key from chunks WHERE chunk_id=$1 AND epub_id=$2 AND status != 'completed';",[chunkID,epubID])
      if (result.rowCount == 0) {
        return []
      }
      return result.rows as {object_key:string}[]
    }catch(err:any){
      console.log("Error checking if chunk already translated:",err.message)
      return []
    }
  }

  async updateChunkStatus(epubID:string,chunkID:string,status:string,msg:string){
    try{
      await this.client.query(`UPDATE chunks SET status=$1, error_msg=$2, updated_at=now()${msg && ', retry_count = retry_count + 1'} WHERE epub_id=$3 AND chunk_id=$4`,[status,msg,epubID,chunkID])
    }catch(err:any){
      console.log("Error updating chunk status:",err.message)
    }
  }
}