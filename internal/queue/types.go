package queue

type TranslationMsg struct {
	RequestID string `json:"requestID"`
	Key string	`json:"key"`
}

type ChunkMsg struct {
	Count int `json:"count"`
	Path []string `json:"path"`
	RequestID string `json:"requestID"`
	Content map[string]string `json:"content"`
}