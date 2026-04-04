package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
)

const geminiDocMaxOutputTokens int32 = 65536

// TwoStepParser runs (1) OCR then (2) one JSON call (structure + <ruby>) on the Ruby model.
// Strategy IDs in settings remain three_step / three_step_remote_ocr for backward compatibility.
// M is used for step 1 when RemoteOCR is nil; Ruby is used for step 2 (if nil at construction, Ruby defaults to M).
// If RemoteOCR is set, step 1 uses it instead of the vision model.
type TwoStepParser struct {
	M                    ExerciseParseModel
	Ruby                 ExerciseParseModel
	ParseMaxOutputTokens int32
	RemoteOCR            PageOCR
}

// NewTwoStepParser builds a parser. If maxOut <= 0, defaults to 65536.
// If ruby is nil, the OCR→JSON step uses m. remoteOCR may be nil (step 1 uses the vision model).
func NewTwoStepParser(m, ruby ExerciseParseModel, maxOut int32, remoteOCR PageOCR) *TwoStepParser {
	if maxOut <= 0 {
		maxOut = geminiDocMaxOutputTokens
	}
	if maxOut > geminiDocMaxOutputTokens {
		log.Printf("ai: parse max output %d exceeds typical API cap (%d)", maxOut, geminiDocMaxOutputTokens)
	}
	if ruby == nil {
		ruby = m
	}
	return &TwoStepParser{M: m, Ruby: ruby, ParseMaxOutputTokens: maxOut, RemoteOCR: remoteOCR}
}

func (p *TwoStepParser) ParseExercisePages(ctx context.Context, pages []ImagePart) (*ParsedExercise, error) {
	if len(pages) == 0 {
		return nil, errors.New("画像がありません")
	}
	log.Printf("parse two_step_begin pages=%d", len(pages))
	raw, err := p.step1OCR(ctx, pages)
	if err != nil {
		return nil, fmt.Errorf("step1_ocr: %w", err)
	}
	out, err := p.step2FromOCR(ctx, raw)
	if err != nil {
		return nil, fmt.Errorf("step2_from_ocr: %w", err)
	}
	log.Printf("parse two_step_done title=%q passage_chars=%d questions=%d",
		Truncate(out.Title, 60), len(out.Passage), len(out.Questions))
	return out, nil
}

func (p *TwoStepParser) step1OCR(ctx context.Context, pages []ImagePart) (string, error) {
	if p.RemoteOCR != nil {
		return p.step1RemoteOCR(ctx, pages)
	}
	n := len(pages)
	sections := make([]string, 0, n)
	z := int32(0)
	for i, page := range pages {
		mime := page.MIME
		if mime == "" {
			mime = "image/jpeg"
		}
		var user string
		if n == 1 {
			user = Step1OCRSingleUser
		} else {
			user = fmt.Sprintf(Step1OCRPageUser, i+1, n)
		}
		prompt := Step1OCRSystem + "\n\n" + user
		op := fmt.Sprintf("step1_ocr_page_%d", i+1)
		log.Printf("parse %s prompt_chars=%d image_bytes=%d mime=%s", op, len(prompt), len(page.Data), mime)

		text, err := p.M.GenerateExerciseParse(ctx, op, "", []ContentPart{
			{Text: prompt},
			{Image: &ImagePart{Data: page.Data, MIME: mime}},
		}, ExerciseParseGenOpts{
			Temperature:      0.1,
			MaxOutputTokens:  p.ParseMaxOutputTokens,
			VisionHighDetail: true,
			ThinkingBudget:   &z,
		})
		if err != nil {
			return "", fmt.Errorf("page %d/%d: %w", i+1, n, err)
		}
		text = StripMarkdownFence(text)
		log.Printf("parse %s response chars=%d preview=%q", op, len(text), LogPreview(text))

		if n > 1 {
			sections = append(sections, fmt.Sprintf("--- ページ %d/%d ---\n%s", i+1, n, text))
		} else {
			sections = append(sections, text)
		}
	}
	combined := strings.Join(sections, "\n\n")
	log.Printf("parse step1_ocr combined_chars=%d", len(combined))
	return combined, nil
}

func (p *TwoStepParser) step1RemoteOCR(ctx context.Context, pages []ImagePart) (string, error) {
	n := len(pages)
	sections := make([]string, 0, n)
	for i, page := range pages {
		op := fmt.Sprintf("step1_remote_ocr_page_%d", i+1)
		log.Printf("parse %s image_bytes=%d mime=%s", op, len(page.Data), page.MIME)
		text, err := p.RemoteOCR.ExtractText(ctx, page)
		if err != nil {
			return "", fmt.Errorf("page %d/%d: %w", i+1, n, err)
		}
		text = strings.TrimSpace(text)
		log.Printf("parse %s response_chars=%d preview=%q", op, len(text), LogPreview(text))
		if n > 1 {
			sections = append(sections, fmt.Sprintf("--- ページ %d/%d ---\n%s", i+1, n, text))
		} else {
			sections = append(sections, text)
		}
	}
	combined := strings.Join(sections, "\n\n")
	log.Printf("parse step1_remote_ocr combined_chars=%d", len(combined))
	return combined, nil
}

func (p *TwoStepParser) step2FromOCR(ctx context.Context, rawText string) (*ParsedExercise, error) {
	user := fmt.Sprintf(Step23FromOCRUser, rawText)
	z := int32(0)
	log.Printf("parse step2_from_ocr raw_chars=%d", len(rawText))

	text, err := p.Ruby.GenerateExerciseParse(ctx, "step2_from_ocr", Step23FromOCRSystem, []ContentPart{{Text: user}}, ExerciseParseGenOpts{
		Temperature:     0.15,
		MaxOutputTokens: p.ParseMaxOutputTokens,
		JSONMode:        true,
		NativeSchema:    NativeExerciseSchemaParsedExerciseWithRuby,
		ThinkingBudget:  &z,
	})
	if err != nil {
		return nil, err
	}
	log.Printf("parse step2_from_ocr response chars=%d preview=%q", len(text), LogPreview(text))

	var out ParsedExercise
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("step2_from_ocr JSON: %w\nraw: %s", err, Truncate(text, 500))
	}
	return &out, nil
}
