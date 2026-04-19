package ai

import (
	"context"
	"fmt"
	"log"
	"strings"
	"unicode/utf8"
)

// ReadingMaterializeMaxPlainRunes caps input length for plain-text materialization.
const ReadingMaterializeMaxPlainRunes = ExplainPassageMaxRunes

// MaterializeReadingFromPlainText turns plain Japanese text into one ParsedExercise (ruby HTML passage + questions).
func MaterializeReadingFromPlainText(ctx context.Context, m ExerciseParseModel, maxOut int32, titleHint, plain string) (ParsedExercise, error) {
	if m == nil {
		return ParsedExercise{}, fmt.Errorf("モデルがありません")
	}
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return ParsedExercise{}, fmt.Errorf("文章が空です")
	}
	if n := utf8.RuneCountInString(plain); n > ReadingMaterializeMaxPlainRunes {
		return ParsedExercise{}, fmt.Errorf("文章が長すぎます（最大%d文字）", ReadingMaterializeMaxPlainRunes)
	}
	if maxOut <= 0 {
		maxOut = geminiDocMaxOutputTokens
	}
	titleHint = strings.TrimSpace(titleHint)
	user := fmt.Sprintf(ReadingMaterializeUserTemplate, titleHint, plain)
	parts := []ContentPart{{Text: user}}
	z := int32(0)
	text, err := m.GenerateExerciseParse(ctx, "reading_materialize", ReadingMaterializeSystem, parts, ExerciseParseGenOpts{
		Temperature:      0.2,
		MaxOutputTokens:  maxOut,
		JSONMode:         true,
		NativeSchema:     NativeExerciseSchemaParsedPageBundleWithRuby,
		VisionHighDetail: false,
		ThinkingBudget:   &z,
	})
	if err != nil {
		return ParsedExercise{}, err
	}
	text = StripMarkdownFence(text)
	log.Printf("reading_materialize response_chars=%d preview=%q", len(text), LogPreview(text))
	list, _, err := decodeParsedPageJSON(text)
	if err != nil {
		return ParsedExercise{}, fmt.Errorf("JSON: %w\nraw: %s", err, Truncate(text, 500))
	}
	if len(list) == 0 {
		return ParsedExercise{}, fmt.Errorf("exercises が空です")
	}
	merged := mergeParsedExercisesFromMultiPageScan(list)
	return merged, nil
}
