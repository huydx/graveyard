package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
)

// OneShotParser asks the vision model once (all pages in one request when the model supports multiple images)
// for structured JSON including ruby. Suited to local VLMs where multi-step pipelines are brittle.
type OneShotParser struct {
	M                    ExerciseParseModel
	ParseMaxOutputTokens int32
}

// NewOneShotParser builds a one-shot parser. If maxOut <= 0, defaults to 65536.
func NewOneShotParser(m ExerciseParseModel, maxOut int32) *OneShotParser {
	if maxOut <= 0 {
		maxOut = geminiDocMaxOutputTokens
	}
	return &OneShotParser{M: m, ParseMaxOutputTokens: maxOut}
}

func (p *OneShotParser) ParseExercisePages(ctx context.Context, pages []ImagePart) (*ParsedExercise, error) {
	if len(pages) == 0 {
		return nil, errors.New("画像がありません")
	}
	n := len(pages)
	var b strings.Builder
	if n == 1 {
		b.WriteString(OneShotSingleUser)
	} else {
		b.WriteString("次のページ画像を順に読み、全体を1つの教材としてJSONにまとめてください。\n")
		for i := range pages {
			b.WriteString(fmt.Sprintf("- ページ %d/%d\n", i+1, n))
		}
	}
	var parts []ContentPart
	parts = append(parts, ContentPart{Text: b.String()})
	for i, page := range pages {
		mime := page.MIME
		if mime == "" {
			mime = "image/jpeg"
		}
		if n > 1 {
			parts = append(parts, ContentPart{Text: fmt.Sprintf(OneShotPageUser, i+1, n)})
		}
		parts = append(parts, ContentPart{Image: &ImagePart{Data: page.Data, MIME: mime}})
	}
	z := int32(0)
	log.Printf("parse one_shot_begin pages=%d", n)
	text, err := p.M.GenerateExerciseParse(ctx, "one_shot_parse", OneShotSystem, parts, ExerciseParseGenOpts{
		Temperature:      0.2,
		MaxOutputTokens:  p.ParseMaxOutputTokens,
		JSONMode:         true,
		NativeSchema:     NativeExerciseSchemaParsedExerciseWithRuby,
		VisionHighDetail: true,
		ThinkingBudget:   &z,
	})
	if err != nil {
		return nil, err
	}
	text = StripMarkdownFence(text)
	log.Printf("parse one_shot response chars=%d preview=%q", len(text), LogPreview(text))

	var out ParsedExercise
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("one_shot JSON: %w\nraw: %s", err, Truncate(text, 500))
	}
	log.Printf("parse one_shot_done title=%q passage_chars=%d questions=%d",
		Truncate(out.Title, 60), len(out.Passage), len(out.Questions))
	return &out, nil
}
