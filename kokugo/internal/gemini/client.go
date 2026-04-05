package gemini

import (
	"context"
	"errors"
	"log"

	"google.golang.org/genai"
)

const defaultMaxParseOutput int32 = 65536

// Client is the Gemini API client. It implements ai.ExerciseParseModel (worksheet parse) and ai.ChatCompleter (judge, summary, transcribe).
type Client struct {
	genai                *genai.Client
	model                string
	judgeModel           string
	parseMaxOutputTokens int32
}

// New creates a client. judgeModel is used for submit scoring when calling chat with that model id; defaults to gemini-2.5-flash-lite if empty.
func New(ctx context.Context, apiKey, model string, parseMaxOutputTokens int32, judgeModel string) (*Client, error) {
	if apiKey == "" {
		return nil, errors.New("GOOGLE_API_KEY が空です")
	}
	c, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, err
	}
	if model == "" {
		model = "gemini-3-flash-preview"
	}
	if judgeModel == "" {
		judgeModel = "gemini-2.5-flash-lite"
	}
	if parseMaxOutputTokens <= 0 {
		parseMaxOutputTokens = defaultMaxParseOutput
	}
	if parseMaxOutputTokens > defaultMaxParseOutput {
		log.Printf("gemini: GEMINI_PARSE_MAX_OUTPUT=%d exceeds documented limit (%d); API will still cap at model max",
			parseMaxOutputTokens, defaultMaxParseOutput)
	}
	return &Client{genai: c, model: model, judgeModel: judgeModel, parseMaxOutputTokens: parseMaxOutputTokens}, nil
}

// Model returns the default chat/generation model id.
func (c *Client) Model() string { return c.model }

// JudgeModel returns the model id used for answer judging.
func (c *Client) JudgeModel() string { return c.judgeModel }
