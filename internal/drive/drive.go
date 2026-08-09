package drive

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
)

const MaxSize = 500 * 1024 * 1024

var (
	ErrNotShared = errors.New("file is not publicly shared or does not exist")
	ErrTooLarge  = errors.New("file exceeds maximum allowed size")
	ErrNotEpub   = errors.New("file is not a valid epub")
)

var epubMimeTypes = map[string]bool{
	"application/epub+zip":         true,
	"application/zip":              true,
	"application/x-zip-compressed": true,
	"application/octet-stream":     true,
}

type Info struct {
	Size     int64
	Filename string
}

type Service struct {
	svc *drive.Service
}

func NewService(apiKey string) (*Service, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("GDRIVE_API_KEY is not configured")
	}
	svc, err := drive.NewService(context.Background(), option.WithAPIKey(apiKey))
	if err != nil {
		return nil, err
	}
	return &Service{svc: svc}, nil
}

func mapAPIError(err error) error {
	var gerr *googleapi.Error
	if errors.As(err, &gerr) {
		switch gerr.Code {
		case http.StatusNotFound, http.StatusForbidden:
			return ErrNotShared
		case http.StatusTooManyRequests:
			return errors.New("google drive rate limit exceeded, try again later")
		}
	}
	return err
}

type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}

var (
	fileIDRegex  = regexp.MustCompile(`/file/d/([-\w]+)`)
	driveIDRegex = regexp.MustCompile(`[-\w]{25,}`)
)

func ExtractFileID(rawLink string) (string, error) {
	link := strings.TrimSpace(rawLink)
	if link == "" {
		return "", errors.New("empty link")
	}

	if driveIDRegex.MatchString(link) && !strings.ContainsAny(link, "/.:?#") {
		return link, nil
	}

	parsed, err := url.Parse(link)
	if err != nil {
		return "", err
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "drive.google.com" && host != "docs.google.com" {
		return "", errors.New("only Google Drive links are supported")
	}

	if m := fileIDRegex.FindStringSubmatch(parsed.Path); len(m) > 1 {
		return m[1], nil
	}

	if strings.Contains(parsed.Path, "/drive/folders/") || strings.Contains(parsed.Path, "/folder/") {
		return "", errors.New("folder links are not supported, share a single file instead")
	}

	if id := parsed.Query().Get("id"); driveIDRegex.MatchString(id) {
		return id, nil
	}

	return "", errors.New("could not find a file ID in the provided link")
}

// CheckFile validates the shared file is an epub and returns its size without
// downloading the file.
func (s *Service) CheckFile(ctx context.Context, fileID string, maxSize int64) (*Info, error) {
	file, err := s.svc.Files.Get(fileID).
		Fields("name,size,mimeType").
		Context(ctx).
		Do()
	if err != nil {
		return nil, mapAPIError(err)
	}

	if !epubMimeTypes[file.MimeType] {
		return nil, ErrNotEpub
	}
	if file.Size > maxSize {
		return nil, ErrTooLarge
	}
	return &Info{Size: file.Size, Filename: file.Name}, nil
}

// Download downloads the shared file into a temp file, enforcing maxSize.
func (s *Service) Download(ctx context.Context, fileID string, maxSize int64) (*os.File, error) {
	resp, err := s.svc.Files.Get(fileID).Context(ctx).Download()
	if err != nil {
		return nil, mapAPIError(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google drive returned status %d", resp.StatusCode)
	}
	if resp.ContentLength > maxSize {
		return nil, ErrTooLarge
	}

	file, err := os.CreateTemp(os.TempDir(), "*.epub")
	if err != nil {
		return nil, err
	}

	reader := &countingReader{r: io.LimitReader(resp.Body, maxSize+1)}
	if _, err := io.Copy(file, reader); err != nil {
		file.Close()
		os.Remove(file.Name())
		return nil, err
	}
	if reader.n > maxSize {
		file.Close()
		os.Remove(file.Name())
		return nil, ErrTooLarge
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		file.Close()
		return nil, err
	}
	return file, nil
}
