package queue

type TranslationMsg struct {
	EpubID string `json:"epubID"`
	Key string	`json:"key"`
	TranslateTo string `json:"translateTo"`
}

type ChunkMsg struct {
	EpubID string `json:"epubID"`
	Count int `json:"count"`
	ChunkID int `json:"chunkID"`
	TranslateTo string `json:"translateTo"`
}

type CompilationMsg struct {
	EpubID string `json:"epubID"`
}