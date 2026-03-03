package epub

import (
	"archive/zip"
	"context"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type S3BulkDownloader interface {
	DownloadTranslatedChunks(ctx context.Context, key string, dst string) error
}

type Compiler struct {
	s3 S3BulkDownloader
}

func NewCompiler(s3 S3BulkDownloader) *Compiler	{
	return &Compiler{
		s3: s3,
	}
}

func (c *Compiler) Unzip(key string, src string, dest string) ([]types.ObjectIdentifier,error) {
	var keys []types.ObjectIdentifier
	r, err := zip.OpenReader(src)
	if err != nil {
		return keys,err
	}
	defer r.Close()

	for _, f := range r.File {
		if strings.Contains(f.Name,"html") {
			keys = append(keys, types.ObjectIdentifier{Key: aws.String(filepath.Join(key,f.Name))})
		}
		path := filepath.Join(dest, f.Name)

		if f.FileInfo().IsDir() {
			os.MkdirAll(path, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(path), os.ModePerm); err != nil {
			return keys,err
		}

		outFile, err := os.Create(path)
		if err != nil {
			return keys,err
		}

		rc, err := f.Open()
		if err != nil {
			return keys,err
		}

		_, err = io.Copy(outFile, rc)

		outFile.Close()
		rc.Close()

		if err != nil {
			return keys,err
		}
	}

	if err := os.Remove(src);err != nil {
		log.Println("Error deleting epub file:",src)
	}
	return keys,nil
}
func (c *Compiler)ZipToEpub(sourceDir, outputFile string) error {
	outFile, err := os.Create(outputFile)
	if err != nil {
		return err
	}
	defer outFile.Close()

	zipWriter := zip.NewWriter(outFile)
	defer zipWriter.Close()

	// 1️⃣ Add mimetype FIRST (no compression)
	mimePath := filepath.Join(sourceDir, "mimetype")
	mimeFile, err := os.Open(mimePath)
	if err != nil {
		return err
	}
	defer mimeFile.Close()

	header := &zip.FileHeader{
		Name:   "mimetype",
		Method: zip.Store, // NO compression
	}
	writer, err := zipWriter.CreateHeader(header)
	if err != nil {
		return err
	}

	if _, err := io.Copy(writer, mimeFile); err != nil {
		return err
	}

	// 2️⃣ Add all other files
	err = filepath.Walk(sourceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip mimetype (already added)
		if path == mimePath {
			return nil
		}

		// Skip root folder itself
		if path == sourceDir {
			return nil
		}

		relPath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}

		header.Name = relPath
		header.Method = zip.Deflate // normal compression

		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}

		_, err = io.Copy(writer, file)
		return err
	})
	if err := os.RemoveAll(sourceDir); err != nil {
		log.Println("Error removing unziped directory:",err)
		return err
	}
	return err
}