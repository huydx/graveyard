package gemini

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"strings"

	"github.com/huydx/kokugo/internal/ai"
	"google.golang.org/genai"
)

// CreateChatCompletion implements ai.ChatCompleter (OpenAI-shaped) on top of the Gemini API.
func (c *Client) CreateChatCompletion(ctx context.Context, req ai.ChatCompletionRequest) (*ai.ChatCompletionResponse, error) {
	model := req.Model
	if model == "" {
		model = c.model
	}

	cfg := &genai.GenerateContentConfig{
		Temperature: ptrFloat32(req.Temperature),
	}
	if req.MaxTokens > 0 {
		cfg.MaxOutputTokens = int32(req.MaxTokens)
	}

	if req.ResponseFormat != nil && req.ResponseFormat.Type == "json_object" {
		cfg.ResponseMIMEType = "application/json"
		switch req.GeminiStructured {
		case ai.ChatGeminiStructuredPrintLearningSummary:
			cfg.ResponseSchema = schemaPrintLearningSummary()
		case ai.ChatGeminiStructuredAnswerJudgment:
			maxR := int64(16)
			cfg.ResponseSchema = schemaAnswerJudgment(&maxR)
		case ai.ChatGeminiStructuredMathExerciseKotsu:
			cfg.ResponseSchema = schemaMathExerciseKotsu()
		case ai.ChatGeminiStructuredPassageSelectionExplain:
			cfg.ResponseSchema = schemaPassageSelectionExplain()
		}
	}

	cfg.ThinkingConfig = thinkingConfigLowEffort(model)

	var systemParts []string
	var contents []*genai.Content
	for _, msg := range req.Messages {
		switch strings.ToLower(msg.Role) {
		case "system":
			t := flattenTextContent(msg)
			if t != "" {
				systemParts = append(systemParts, t)
			}
		case "assistant":
			parts, err := messageToParts(msg)
			if err != nil {
				return nil, err
			}
			contents = append(contents, &genai.Content{Role: string(genai.RoleModel), Parts: parts})
		default: // user
			parts, err := messageToParts(msg)
			if err != nil {
				return nil, err
			}
			contents = append(contents, &genai.Content{Role: string(genai.RoleUser), Parts: parts})
		}
	}
	if len(systemParts) > 0 {
		cfg.SystemInstruction = &genai.Content{Parts: []*genai.Part{{Text: strings.Join(systemParts, "\n\n")}}}
	}
	if len(contents) == 0 {
		return nil, fmt.Errorf("gemini chat: no user/model messages")
	}

	jsonMode := req.ResponseFormat != nil && req.ResponseFormat.Type == "json_object"
	logChatGeminiRequest(model, cfg, contents, jsonMode, req.GeminiStructured)

	resp, err := c.genai.Models.GenerateContent(ctx, model, contents, cfg)
	if err != nil {
		log.Printf("gemini_chat_error op=GenerateContent model=%s json=%v structured=%d user_msgs=%d err=%v",
			model, jsonMode, int(req.GeminiStructured), len(contents), err)
		return nil, fmt.Errorf("gemini GenerateContent: %w", err)
	}
	logUsage("chat_completion", model, resp)
	text, err := extractText(resp)
	if err != nil {
		logGeminiChatFailure("chat_completion", model, resp, err)
		return nil, fmt.Errorf("gemini extract: %w", err)
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

func flattenTextContent(msg ai.ChatMessage) string {
	var b strings.Builder
	for _, p := range msg.Content {
		if p.Type == "text" || p.Type == "" {
			b.WriteString(p.Text)
		}
	}
	return strings.TrimSpace(b.String())
}

func messageToParts(msg ai.ChatMessage) ([]*genai.Part, error) {
	var parts []*genai.Part
	for _, p := range msg.Content {
		switch p.Type {
		case "text", "":
			if p.Text != "" {
				parts = append(parts, &genai.Part{Text: p.Text})
			}
		case "input_audio":
			if p.InputAudio == nil || len(p.InputAudio.Data) == 0 {
				return nil, fmt.Errorf("gemini chat: empty input_audio")
			}
			mime := p.InputAudio.MIME
			if mime == "" {
				mime = "audio/mp4"
			}
			parts = append(parts, &genai.Part{InlineData: &genai.Blob{Data: p.InputAudio.Data, MIMEType: mime}})
		case "image_url":
			if p.ImageURL == nil || p.ImageURL.URL == "" {
				return nil, fmt.Errorf("gemini chat: empty image_url")
			}
			data, mime, err := decodeDataURL(p.ImageURL.URL)
			if err != nil {
				return nil, err
			}
			parts = append(parts, &genai.Part{InlineData: &genai.Blob{Data: data, MIMEType: mime}})
		default:
			return nil, fmt.Errorf("gemini chat: unsupported content type %q", p.Type)
		}
	}
	if len(parts) == 0 {
		return nil, fmt.Errorf("gemini chat: message has no parts")
	}
	return parts, nil
}

func decodeDataURL(u string) ([]byte, string, error) {
	const prefix = "data:"
	if !strings.HasPrefix(u, prefix) {
		return nil, "", fmt.Errorf("gemini chat: image_url must be a data: URL")
	}
	u = strings.TrimPrefix(u, prefix)
	idx := strings.IndexByte(u, ',')
	if idx <= 0 {
		return nil, "", fmt.Errorf("gemini chat: invalid data URL")
	}
	meta, b64 := u[:idx], u[idx+1:]
	mime := "image/jpeg"
	if strings.HasPrefix(meta, "image/") {
		if semi := strings.IndexByte(meta, ';'); semi > 0 {
			mime = meta[:semi]
		} else {
			mime = meta
		}
	}
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, "", fmt.Errorf("gemini chat: base64 decode: %w", err)
	}
	return raw, mime, nil
}
