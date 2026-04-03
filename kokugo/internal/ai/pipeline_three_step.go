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

// ThreeStepParser runs OCR → structure (plain JSON) → ruby JSON.
// M is used for steps 1–2; Ruby for step 3 (furigana). If ruby is nil, M is used for all steps.
type ThreeStepParser struct {
	M                    ExerciseParseModel
	Ruby                 ExerciseParseModel
	ParseMaxOutputTokens int32
}

// NewThreeStepParser builds a parser. If maxOut <= 0, defaults to 65536.
// If ruby is nil, step 3 uses m.
func NewThreeStepParser(m, ruby ExerciseParseModel, maxOut int32) *ThreeStepParser {
	if maxOut <= 0 {
		maxOut = geminiDocMaxOutputTokens
	}
	if maxOut > geminiDocMaxOutputTokens {
		log.Printf("ai: parse max output %d exceeds typical API cap (%d)", maxOut, geminiDocMaxOutputTokens)
	}
	if ruby == nil {
		ruby = m
	}
	return &ThreeStepParser{M: m, Ruby: ruby, ParseMaxOutputTokens: maxOut}
}

func (p *ThreeStepParser) ParseExercisePages(ctx context.Context, pages []ImagePart) (*ParsedExercise, error) {
	if len(pages) == 0 {
		return nil, errors.New("画像がありません")
	}
	log.Printf("parse three_step_begin pages=%d", len(pages))
	raw, err := p.step1OCR(ctx, pages)
	if err != nil {
		return nil, fmt.Errorf("step1_ocr: %w", err)
	}
	plain, err := p.step2Structure(ctx, raw)
	if err != nil {
		return nil, fmt.Errorf("step2_structure: %w", err)
	}
	out, err := p.step3Ruby(ctx, plain)
	if err != nil {
		return nil, fmt.Errorf("step3_ruby: %w", err)
	}
	log.Printf("parse three_step_done title=%q passage_chars=%d questions=%d",
		Truncate(out.Title, 60), len(out.Passage), len(out.Questions))
	return out, nil
}

func (p *ThreeStepParser) step1OCR(ctx context.Context, pages []ImagePart) (string, error) {
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

func (p *ThreeStepParser) step2Structure(ctx context.Context, rawText string) (*ParsedExercise, error) {
	user := fmt.Sprintf(Step2StructureUser, rawText)
	z := int32(0)
	log.Printf("parse step2_structure raw_chars=%d", len(rawText))

	text, err := p.M.GenerateExerciseParse(ctx, "step2_structure", Step2StructureSystem, []ContentPart{{Text: user}}, ExerciseParseGenOpts{
		Temperature:     0.2,
		MaxOutputTokens: p.ParseMaxOutputTokens,
		JSONMode:        true,
		NativeSchema:    NativeExerciseSchemaPlainParsedExercise,
		ThinkingBudget:  &z,
	})
	if err != nil {
		return nil, err
	}
	log.Printf("parse step2_structure response chars=%d preview=%q", len(text), LogPreview(text))

	var out ParsedExercise
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("step2 JSON: %w\nraw: %s", err, Truncate(text, 500))
	}
	return &out, nil
}

func (p *ThreeStepParser) step3Ruby(ctx context.Context, plain *ParsedExercise) (*ParsedExercise, error) {
	inJSON, err := json.Marshal(plain)
	if err != nil {
		return nil, err
	}
	user := fmt.Sprintf(Step3RubyUser, string(inJSON))
	z := int32(0)
	log.Printf("parse step3_ruby json_input_chars=%d", len(inJSON))

	text, err := p.Ruby.GenerateExerciseParse(ctx, "step3_ruby", Step3RubySystem, []ContentPart{{Text: user}}, ExerciseParseGenOpts{
		Temperature:     0.2,
		MaxOutputTokens: p.ParseMaxOutputTokens,
		JSONMode:        true,
		NativeSchema:    NativeExerciseSchemaParsedExerciseWithRuby,
		ThinkingBudget:  &z,
	})
	if err != nil {
		return nil, err
	}
	log.Printf("parse step3_ruby response chars=%d preview=%q", len(text), LogPreview(text))

	var out ParsedExercise
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("step3 JSON: %w\nraw: %s", err, Truncate(text, 500))
	}
	return &out, nil
}
