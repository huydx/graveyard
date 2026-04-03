package ollama

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/huydx/kokugo/internal/ai"
)

// ChatClient implements ai.ChatCompleter via Ollama /api/chat (OpenAI-shaped requests).
type ChatClient struct {
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

// NewChatClient builds a chat client. model should be a text/JSON-capable tag (can differ from vision model).
func NewChatClient(baseURL, model string) *ChatClient {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "http://127.0.0.1:11434"
	}
	return &ChatClient{
		BaseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		Model:   strings.TrimSpace(model),
		HTTPClient: &http.Client{
			Timeout: 15 * time.Minute,
		},
	}
}

// CreateChatCompletion implements ai.ChatCompleter.
func (c *ChatClient) CreateChatCompletion(ctx context.Context, req ai.ChatCompletionRequest) (*ai.ChatCompletionResponse, error) {
	if c.Model == "" && strings.TrimSpace(req.Model) == "" {
		return nil, fmt.Errorf("ollama chat: model is empty")
	}
	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = c.Model
	}

	var msgs []chatMessage
	for _, m := range req.Messages {
		role := strings.ToLower(m.Role)
		if role == "system" {
			role = "system"
		} else if role == "assistant" {
			role = "assistant"
		} else {
			role = "user"
		}
		text, images, err := flattenOllamaMessage(m)
		if err != nil {
			return nil, err
		}
		msgs = append(msgs, chatMessage{
			Role:    role,
			Content: text,
			Images:  images,
		})
	}

	maxTok := req.MaxTokens
	if maxTok <= 0 {
		maxTok = 8192
	}
	body := chatRequest{
		Model:    model,
		Messages: msgs,
		Stream:   false,
		Options: map[string]any{
			"temperature": float64(req.Temperature),
			"num_predict": maxTok,
		},
	}
	if req.ResponseFormat != nil && req.ResponseFormat.Type == "json_object" {
		body.Format = "json"
	}

	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	url := c.BaseURL + "/api/chat"
	log.Printf("ollama_chat url=%s model=%s messages=%d", url, model, len(msgs))

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ollama chat: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ollama chat http %d: %s", resp.StatusCode, truncateStr(string(respBody), 500))
	}

	var out chatResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, fmt.Errorf("ollama chat decode: %w", err)
	}
	text := strings.TrimSpace(out.Message.Content)
	if text == "" {
		return nil, fmt.Errorf("ollama chat: empty assistant message")
	}
	return &ai.ChatCompletionResponse{
		Choices: []ai.ChatCompletionChoice{
			{
				Message: ai.ChatMessage{
					Role: "assistant",
					Content: []ai.ChatContentPart{
						{Type: "text", Text: text},
					},
				},
			},
		},
	}, nil
}

func flattenOllamaMessage(m ai.ChatMessage) (text string, images []string, err error) {
	var b strings.Builder
	for _, p := range m.Content {
		switch p.Type {
		case "text", "":
			if p.Text != "" {
				if b.Len() > 0 {
					b.WriteString("\n\n")
				}
				b.WriteString(p.Text)
			}
		case "image_url":
			if p.ImageURL == nil || p.ImageURL.URL == "" {
				return "", nil, fmt.Errorf("ollama chat: empty image_url")
			}
			raw, err := decodeDataURLBase64(p.ImageURL.URL)
			if err != nil {
				return "", nil, err
			}
			images = append(images, raw)
		case "input_audio":
			return "", nil, fmt.Errorf("ollama chat: input_audio is not supported; use Gemini for transcription")
		default:
			return "", nil, fmt.Errorf("ollama chat: unsupported content type %q", p.Type)
		}
	}
	return b.String(), images, nil
}

func decodeDataURLBase64(u string) (string, error) {
	const prefix = "data:"
	if !strings.HasPrefix(u, prefix) {
		return "", fmt.Errorf("ollama: expected data URL for image")
	}
	u = strings.TrimPrefix(u, prefix)
	idx := strings.IndexByte(u, ',')
	if idx <= 0 {
		return "", fmt.Errorf("ollama: invalid data URL")
	}
	b64 := u[idx+1:]
	if _, err := base64.StdEncoding.DecodeString(b64); err != nil {
		return "", fmt.Errorf("ollama: image base64: %w", err)
	}
	return b64, nil
}
