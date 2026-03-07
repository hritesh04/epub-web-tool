package epub

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path"
	"strings"

	"github.com/rs/zerolog/log"

	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/model"
	"github.com/hritesh04/epub-web-tool/internal/queue"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
)

const MAX_FILE_PER_CHUNK int = 5

type DownloadService interface {
	Download(ctx context.Context,key string) error
}

type ConsumerService interface {
	ConsumeTranslationMsg(ctx context.Context) (queue.TranslationMsg,error)
}

type Chunker struct {
	db *repository.ChunkRepository
	s3 *s3.S3Uploader
	// queue ConsumerService
}

func NewChunker(db *repository.ChunkRepository, s3 *s3.S3Uploader) *Chunker{
	return &Chunker{
		db: db,
		s3: s3,
		// queue: queue,
	}
}

func (c *Chunker) Chunk(ctx context.Context, file *os.File, msg queue.TranslationMsg) ([]queue.ChunkMsg, error) {
	var chunks []queue.ChunkMsg
	var chunkDTO []model.Chunk
	defer file.Close()
	
	reader, pkg, err := c.getOpfDetails(file)
	if err != nil {
		return chunks,err
	}
	log.Info().Str("root_dir", pkg.RootDir).Msg("OPF details retrieved")
	var chunk queue.ChunkMsg
	chunk.EpubID=msg.EpubID
	chunk.ChunkID=1
	chunk.TranslateTo=msg.TranslateTo
	channel,wg := c.s3.UploadConcurently(ctx)


	for _,item := range pkg.Manifest.Items {
		manifestItem := item
		if manifestItem.MediaType == "application/xhtml+xml" || manifestItem.MediaType == "application/x-dtbncx+xml"{
			filePath := path.Join(pkg.RootDir,manifestItem.Href)
			html,err := reader.Open(filePath)
			if err != nil {
				log.Error().Err(err).Str("file", manifestItem.Href).Msg("Error opening html")
				continue
			}

			data, err := io.ReadAll(html)
			if err != nil {
				log.Error().Err(err).Msg("Read error")
			}
			html.Close()

			dataReader := bytes.NewReader(data)
			_, err = dataReader.Seek(0, io.SeekStart)
			if err != nil {
				log.Fatal().Err(err).Msg("Seek error")
			}
			
			if chunk.Count == MAX_FILE_PER_CHUNK {
				id := chunk.ChunkID
				chunks = append(chunks, chunk)
				chunk=queue.ChunkMsg{
					Count: 0,
					ChunkID: id+1,
					EpubID: msg.EpubID,
					TranslateTo: msg.TranslateTo,
				}
			}
			channel<-s3.ChunkObject{
				Key: path.Join(msg.EpubID,filePath),
				Reader: dataReader,
			}
			chunkDTO=append(chunkDTO, model.Chunk{
				Id: uuid.NewString(),
				EpubID: msg.EpubID,
				ChunkID: chunk.ChunkID,
				ChapterPath: filePath,
				ObjectKey: path.Join(msg.EpubID,filePath),
			})
			chunk.Count++
		}
	}
	chunks = append(chunks, chunk)
	close(channel)
	wg.Wait()
	if err := c.db.InsertChunk(ctx,chunkDTO); err != nil {
		return chunks,err
	}
	
	return chunks,nil
}

func (c *Chunker) getOpfDetails(file *os.File)(*zip.Reader,Package,error){
	var pkg Package
	stat,_ := file.Stat()	
	reader, err := zip.NewReader(file,stat.Size())
	if err != nil {
		log.Error().Err(err).Msg("Error creating zip reader")
		return reader,pkg,err
	}
	
	containerFile, err := reader.Open("META-INF/container.xml")
	if err != nil {
		return reader,pkg,err
	}
	defer containerFile.Close()

	metadataDecoder := xml.NewDecoder(containerFile)

	var container Container
	if err := metadataDecoder.Decode(&container); err != nil {
		return reader,pkg,err
	}

	fmt.Println("OPF path:", container.RootFiles.RootFile[0].FullPath)

	opfPath := container.RootFiles.RootFile[0].FullPath
	
	opfFile,err :=reader.Open(opfPath)
	if err != nil {
		return reader,pkg,err
	}
	
	opfDecoder := xml.NewDecoder(opfFile)

	if err := opfDecoder.Decode(&pkg); err != nil {
		return reader,pkg,err
	}
	opfPathFields := strings.Split(opfPath,"/")
	pkg.RootDir=strings.Join(opfPathFields[:len(opfPathFields)-1],"/")
	return reader,pkg,nil
}