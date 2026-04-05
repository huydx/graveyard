package gemini

import (
	"context"
	"log"

	"github.com/huydx/kokugo/internal/ai"
	"google.golang.org/genai"
)

// GenerateExerciseParse implements ai.ExerciseParseModel for one-shot worksheet vision → JSON.
func (c *Client) GenerateExerciseParse(ctx context.Context, op string, systemInstruction string, parts []ai.ContentPart, opts ai.ExerciseParseGenOpts) (string, error) {
	maxTok := opts.MaxOutputTokens
	if maxTok <= 0 {
		maxTok = c.parseMaxOutputTokens
	}

	cfg := &genai.GenerateContentConfig{
		Temperature:     ptrFloat32(opts.Temperature),
		MaxOutputTokens: maxTok,
	}
	if systemInstruction != "" {
		cfg.SystemInstruction = &genai.Content{Parts: []*genai.Part{{Text: systemInstruction}}}
	}
	if tc := thinkingConfigForParse(c.model, opts.ThinkingBudget); tc != nil {
		cfg.ThinkingConfig = tc
	}
	if opts.VisionHighDetail {
		cfg.MediaResolution = genai.MediaResolutionHigh
	}

	if opts.JSONMode || opts.NativeSchema != ai.NativeExerciseSchemaNone {
		cfg.ResponseMIMEType = "application/json"
	}
	switch opts.NativeSchema {
	case ai.NativeExerciseSchemaPlainParsedExercise:
		cfg.ResponseSchema = schemaParsedExercisePlain()
	case ai.NativeExerciseSchemaParsedExerciseWithRuby:
		cfg.ResponseSchema = schemaParsedExercise()
	case ai.NativeExerciseSchemaParsedPageBundleWithRuby:
		cfg.ResponseSchema = schemaParsedPageBundle()
	}

	genParts := make([]*genai.Part, 0, len(parts)*2)
	for _, p := range parts {
		if p.Text != "" {
			genParts = append(genParts, &genai.Part{Text: p.Text})
		}
		if p.Image != nil {
			mime := p.Image.MIME
			if mime == "" {
				mime = "image/jpeg"
			}
			genParts = append(genParts, &genai.Part{InlineData: &genai.Blob{Data: p.Image.Data, MIMEType: mime}})
		}
	}

	logExerciseParseGeminiRequest(op, c.model, systemInstruction, genParts, opts, maxTok, cfg)

	resp, err := c.genai.Models.GenerateContent(ctx, c.model, []*genai.Content{{Parts: genParts}}, cfg)
	if err != nil {
		log.Printf("gemini_error op=%s model=%s err=%v", op, c.model, err)
		return "", err
	}
	logUsage(op, c.model, resp)
	text, err := extractText(resp)
	if err != nil {
		log.Printf("gemini_error op=%s extract_err=%v", op, err)
		return "", err
	}
	return text, nil
}
