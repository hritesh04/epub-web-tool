package epub

import (
	"archive/zip"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"os"
	"path"
	"strings"

	"github.com/hritesh04/epub-web-tool/internal/queue"
)

const MAX_FILE_PER_CHUNK int = 5

type DownloadService interface {
	Download(ctx context.Context,key string) error
}

type ConsumerService interface {
	ConsumeTranslationMsg(ctx context.Context) (queue.TranslationMsg,error)
}

type Chunker struct {
	// s3 DownloadService
	// queue ConsumerService
}

func NewChunker() *Chunker{
	return &Chunker{
		// s3: s3,
		// queue: queue,
	}
}

func (c *Chunker) Chunk(key string, file *os.File) ([]queue.ChunkMsg, error) {
	var chunks []queue.ChunkMsg
	defer file.Close()
	
	reader, pkg, err := c.getOpfDetails(file)
	if err != nil {
		return chunks,err
	}
	log.Println("OPF RootDir:",pkg.RootDir)
	var chunk queue.ChunkMsg
	chunk.RequestID=key
	chunk.Content=make(map[string]string)
	for _,item := range pkg.Manifest.Items {
		manifestItem := item
		if manifestItem.MediaType == "application/xhtml+xml"{
			html,err := reader.Open(path.Join(pkg.RootDir,manifestItem.Href))
			if err != nil {
				log.Println("Error opening html","file:",manifestItem.Href,"error",err)
				continue
			}
			content,err := io.ReadAll(html)
			if err != nil {
				log.Println("Error reading html","file:",manifestItem.Href,"error:",err)
				continue
			}
			if chunk.Count == MAX_FILE_PER_CHUNK {
				chunks = append(chunks, chunk)
				chunk=queue.ChunkMsg{
					Content: make(map[string]string),
					RequestID: key,
				}
			}
			chunk.Path = append(chunk.Path, manifestItem.Href)
			chunk.Content[manifestItem.Href]=string(content)
			chunk.Count++
		}
	}
	return chunks,nil
}

func (c *Chunker) getOpfDetails(file *os.File)(*zip.Reader,Package,error){
	var pkg Package
	stat,_ := file.Stat()	
	reader, err := zip.NewReader(file,stat.Size())
	if err != nil {
		log.Println("Error creating zip reader:",err)
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