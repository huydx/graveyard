package paddleocr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/huydx/kokugo/internal/ai"
)

// Client calls a PaddleOCR VL–compatible HTTP API (POST /ocr with multipart file field "file").
type Client struct {
	BaseURL string
	HTTP    *http.Client
}

// NewClient returns a client for baseURL (trailing slashes stripped). httpClient may be nil.
func NewClient(baseURL string, httpClient *http.Client) *Client {
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 3 * time.Minute}
	}
	return &Client{BaseURL: base, HTTP: httpClient}
}

var _ ai.PageOCR = (*Client)(nil)

type textBlock struct {
	Content string `json:"content"`
}

type ocrResponse struct {
	Blocks []textBlock `json:"blocks"`
	Text   string      `json:"text"`
}

type errBody struct {
	Error  string          `json:"error"`
	Detail json.RawMessage `json:"detail"`
}

// ExtractText implements ai.PageOCR.
func (c *Client) ExtractText(ctx context.Context, page ai.ImagePart) (string, error) {
	if c == nil || c.BaseURL == "" {
		return "", fmt.Errorf("paddleocr: empty base URL")
	}
	if len(page.Data) == 0 {
		return "", fmt.Errorf("paddleocr: empty image")
	}
	mime := page.MIME
	if mime == "" {
		mime = "image/jpeg"
	}
	fname := filenameHint(mime)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, err := mw.CreateFormFile("file", fname)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(page.Data); err != nil {
		return "", err
	}
	if err := mw.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/ocr", &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	bodyStr := string(raw)
	log.Printf("paddleocr: response status=%s body_bytes=%d body_preview=%s",
		resp.Status, len(raw), ai.LogPreview(bodyStr))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("paddleocr: %s", formatAPIError(raw, resp.Status))
	}
	var out ocrResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("paddleocr: decode response: %w", err)
	}
	text := strings.TrimSpace(out.Text)
	if text != "" {
		log.Printf("paddleocr: parsed text_chars=%d text_preview=%q", len(text), ai.LogPreview(text))
		return text, nil
	}
	if len(out.Blocks) == 0 {
		return "", nil
	}
	parts := make([]string, 0, len(out.Blocks))
	for _, bl := range out.Blocks {
		line := strings.TrimSpace(bl.Content)
		if line != "" {
			parts = append(parts, line)
		}
	}
	joined := strings.Join(parts, "\n")
	log.Printf("paddleocr: parsed from blocks count=%d joined_chars=%d preview=%q",
		len(out.Blocks), len(joined), ai.LogPreview(joined))
	return joined, nil
}

func formatAPIError(raw []byte, status string) string {
	var eb errBody
	if err := json.Unmarshal(raw, &eb); err != nil {
		s := strings.TrimSpace(string(raw))
		if s == "" {
			return status
		}
		return s
	}
	if msg := strings.TrimSpace(eb.Error); msg != "" {
		return msg
	}
	if len(eb.Detail) > 0 && string(eb.Detail) != "null" {
		return string(bytes.TrimSpace(eb.Detail))
	}
	if status != "" {
		return status
	}
	return "unknown error"
}

func filenameHint(mime string) string {
	switch strings.ToLower(mime) {
	case "image/png":
		return "page.png"
	case "image/webp":
		return "page.webp"
	case "image/tiff", "image/tif":
		return "page.tiff"
	case "image/bmp":
		return "page.bmp"
	case "image/gif":
		return "page.gif"
	default:
		return "page.jpg"
	}
}
