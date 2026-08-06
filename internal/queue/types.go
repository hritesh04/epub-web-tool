package queue

import (
	"context"

	"github.com/hritesh04/epub-web-tool/internal/otel"
)

type TranslationMsg struct {
	EpubID      string `json:"epubID"`
	Key         string `json:"key"`
	TranslateTo string `json:"translateTo"`
	TraceParent string `json:"traceparent,omitempty"`
	TraceState  string `json:"tracestate,omitempty"`
}

type ChunkMsg struct {
	EpubID      string `json:"epubID"`
	Count       int    `json:"count"`
	ChunkID     int    `json:"chunkID"`
	TranslateTo string `json:"translateTo"`
	TraceParent string `json:"traceparent,omitempty"`
	TraceState  string `json:"tracestate,omitempty"`
}

type CompilationMsg struct {
	EpubID      string `json:"epubID"`
	TraceParent string `json:"traceparent,omitempty"`
	TraceState  string `json:"tracestate,omitempty"`
}

// SetTraceContext stores the W3C trace context from the active span in ctx.
func SetTraceContext(ctx context.Context, m interface {
	GetTraceContext() (string, string)
	SetTraceContext(string, string)
}) {
	traceparent, tracestate := otel.EncodeTraceParent(ctx)
	m.SetTraceContext(traceparent, tracestate)
}

func (m *TranslationMsg) GetTraceContext() (string, string) { return m.TraceParent, m.TraceState }
func (m *TranslationMsg) SetTraceContext(tp, ts string)    { m.TraceParent, m.TraceState = tp, ts }

func (m *ChunkMsg) GetTraceContext() (string, string) { return m.TraceParent, m.TraceState }
func (m *ChunkMsg) SetTraceContext(tp, ts string)     { m.TraceParent, m.TraceState = tp, ts }

func (m *CompilationMsg) GetTraceContext() (string, string) { return m.TraceParent, m.TraceState }
func (m *CompilationMsg) SetTraceContext(tp, ts string)    { m.TraceParent, m.TraceState = tp, ts }