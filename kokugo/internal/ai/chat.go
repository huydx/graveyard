package ai

import (
	"context"
	"errors"
	"strings"
)

// ChatResponseFormat mirrors OpenAI chat.completions response_format (subset).
type ChatResponseFormat struct {
	Type string `json:"type"` // "text" | "json_object"
}

// ChatGeminiStructuredKind enables Gemini-native JSON schemas for chat completions. Other adapters ignore it.
type ChatGeminiStructuredKind int

const (
	ChatGeminiStructuredNone ChatGeminiStructuredKind = iota
	ChatGeminiStructuredPrintLearningSummary
	ChatGeminiStructuredAnswerJudgment
)

// ChatImageURL is an OpenAI-style image_url block (often a data: URL with base64).
type ChatImageURL struct {
	URL    string
	Detail string // optional: "low" | "high" | "auto" — Gemini may map to media resolution
}

// ChatInputAudio is OpenAI-style input_audio for multimodal user messages.
type ChatInputAudio struct {
	Data []byte
	MIME string
}

// ChatContentPart is one segment inside a chat message (OpenAI multimodal content array shape).
type ChatContentPart struct {
	Type       string // "text" | "image_url" | "input_audio"
	Text       string
	ImageURL   *ChatImageURL
	InputAudio *ChatInputAudio
}

// ChatMessage is one message in a chat completion request.
type ChatMessage struct {
	Role    string // "system" | "user" | "assistant"
	Content []ChatContentPart
}

// TextMessage builds a single text-only message.
func TextMessage(role, text string) ChatMessage {
	if text == "" {
		return ChatMessage{Role: role}
	}
	return ChatMessage{
		Role: role,
		Content: []ChatContentPart{
			{Type: "text", Text: text},
		},
	}
}

// ChatCompletionRequest follows the OpenAI Chat Completions API shape (fields used by our adapters).
type ChatCompletionRequest struct {
	Model            string
	Messages         []ChatMessage
	Temperature      float32
	MaxTokens        int
	ResponseFormat   *ChatResponseFormat
	GeminiStructured ChatGeminiStructuredKind
}

// ChatCompletionResponse follows the OpenAI response shape (minimal subset).
type ChatCompletionResponse struct {
	Choices []ChatCompletionChoice
}

// ChatCompletionChoice is one completion choice.
type ChatCompletionChoice struct {
	Message ChatMessage
}

// ChatCompleter is implemented by Gemini and Ollama adapters (OpenAI-compatible orchestration for judge, summary, transcribe).
type ChatCompleter interface {
	CreateChatCompletion(ctx context.Context, req ChatCompletionRequest) (*ChatCompletionResponse, error)
}

// FirstAssistantContent returns the first assistant message text content.
func FirstAssistantContent(resp *ChatCompletionResponse) (string, error) {
	if resp == nil || len(resp.Choices) == 0 {
		return "", errors.New("chat: empty choices")
	}
	msg := resp.Choices[0].Message
	var b strings.Builder
	for _, p := range msg.Content {
		if p.Type == "text" || p.Type == "" {
			b.WriteString(p.Text)
		}
	}
	s := strings.TrimSpace(b.String())
	if s == "" {
		return "", errors.New("chat: empty assistant content")
	}
	return s, nil
}
