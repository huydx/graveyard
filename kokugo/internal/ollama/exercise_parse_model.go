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

// ExerciseModel calls Ollama /api/chat for worksheet image parsing (vision).
type ExerciseModel struct {
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

// NewExerciseModel returns a model for ai.ExerciseParseModel. model must be vision-capable for image steps.
func NewExerciseModel(baseURL, model string) *ExerciseModel {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "http://127.0.0.1:11434"
	}
	return &ExerciseModel{
		BaseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		Model:   strings.TrimSpace(model),
		HTTPClient: &http.Client{
			Timeout: 15 * time.Minute,
		},
	}
}

// GenerateExerciseParse implements ai.ExerciseParseModel.
func (c *ExerciseModel) GenerateExerciseParse(ctx context.Context, op string, systemInstruction string, parts []ai.ContentPart, opts ai.ExerciseParseGenOpts) (string, error) {
	if c.Model == "" {
		return "", fmt.Errorf("ollama: model is empty")
	}
	var userText strings.Builder
	var images []string
	for _, p := range parts {
		if p.Text != "" {
			if userText.Len() > 0 {
				userText.WriteString("\n\n")
			}
			userText.WriteString(p.Text)
		}
		if p.Image != nil && len(p.Image.Data) > 0 {
			images = append(images, base64.StdEncoding.EncodeToString(p.Image.Data))
		}
	}
	msgs := make([]chatMessage, 0, 2)
	if systemInstruction != "" {
		msgs = append(msgs, chatMessage{Role: "system", Content: systemInstruction})
	}
	msgs = append(msgs, chatMessage{
		Role:    "user",
		Content: userText.String(),
		Images:  images,
	})

	nPredict := int(opts.MaxOutputTokens)
	if nPredict <= 0 {
		nPredict = 8192
	}
	reqBody := chatRequest{
		Model:    c.Model,
		Messages: msgs,
		Stream:   false,
		Options: map[string]any{
			"temperature": float64(opts.Temperature),
			"num_predict": nPredict,
		},
	}
	if opts.JSONMode {
		reqBody.Format = "json"
	}

	raw, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}
	url := c.BaseURL + "/api/chat"
	log.Printf("ollama_parse op=%s url=%s model=%s images=%d prompt_chars=%d", op, url, c.Model, len(images), userText.Len())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("ollama request: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("ollama http %d: %s", resp.StatusCode, truncateStr(string(body), 500))
	}

	var out chatResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return "", fmt.Errorf("ollama decode: %w body=%s", err, truncateStr(string(body), 300))
	}
	text := strings.TrimSpace(out.Message.Content)
	if text == "" {
		return "", fmt.Errorf("ollama: empty assistant content (op=%s)", op)
	}
	return text, nil
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
