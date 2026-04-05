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

// OneShotParser runs one Gemini vision call per page, then concatenates exercises in page order.
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

func oneShotUserText(pageIndex1, totalPages int) string {
	if totalPages == 1 {
		return OneShotSingleUser
	}
	return oneShotUserExtractionRules + "\n\n" + fmt.Sprintf(OneShotPageUser, pageIndex1, totalPages)
}

// decodeParsedPageJSON accepts either {"exercises":[...]} (週課・複数大問) or a legacy single ParsedExercise object.
func decodeParsedPageJSON(text string) ([]ParsedExercise, error) {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal([]byte(text), &probe); err != nil {
		return nil, err
	}
	if _, ok := probe["exercises"]; ok {
		var bundle struct {
			Exercises []ParsedExercise `json:"exercises"`
		}
		if err := json.Unmarshal([]byte(text), &bundle); err != nil {
			return nil, err
		}
		if len(bundle.Exercises) == 0 {
			return nil, fmt.Errorf("exercises が空です")
		}
		return bundle.Exercises, nil
	}
	var single ParsedExercise
	if err := json.Unmarshal([]byte(text), &single); err != nil {
		return nil, err
	}
	return []ParsedExercise{single}, nil
}

// concatParsedPages flattens per-page exercise lists in order (page1 ex1, ex2, … then page2 …).
func concatParsedPages(pages [][]ParsedExercise) []ParsedExercise {
	var out []ParsedExercise
	for _, pe := range pages {
		out = append(out, pe...)
	}
	return out
}

// mergeParsedExercisesFromMultiPageScan joins every parsed block (across pages) into one exercise.
// Users who upload several photos as one worksheet expect a single だい in the app, not one per image.
func mergeParsedExercisesFromMultiPageScan(blocks []ParsedExercise) ParsedExercise {
	if len(blocks) == 0 {
		return ParsedExercise{}
	}
	if len(blocks) == 1 {
		return blocks[0]
	}
	seenTitle := make(map[string]struct{})
	var titles []string
	for _, b := range blocks {
		t := strings.TrimSpace(b.Title)
		if t == "" {
			continue
		}
		if _, ok := seenTitle[t]; ok {
			continue
		}
		seenTitle[t] = struct{}{}
		titles = append(titles, t)
	}
	title := strings.Join(titles, " · ")
	if title == "" {
		title = "よみとり"
	}
	var passageParts []string
	for _, b := range blocks {
		p := strings.TrimSpace(b.Passage)
		if p != "" {
			passageParts = append(passageParts, p)
		}
	}
	passage := strings.Join(passageParts, "\n\n")
	var questions []ParsedQuestion
	for _, b := range blocks {
		questions = append(questions, b.Questions...)
	}
	return ParsedExercise{Title: title, Passage: passage, Questions: questions}
}

func (p *OneShotParser) parseSinglePage(ctx context.Context, page ImagePart, pageIndex1, totalPages int) ([]ParsedExercise, error) {
	mime := page.MIME
	if mime == "" {
		mime = "image/jpeg"
	}
	parts := []ContentPart{
		{Text: oneShotUserText(pageIndex1, totalPages)},
		{Image: &ImagePart{Data: page.Data, MIME: mime}},
	}
	z := int32(0)
	text, err := p.M.GenerateExerciseParse(ctx, "one_shot_parse", OneShotSystem, parts, ExerciseParseGenOpts{
		Temperature:      0.2,
		MaxOutputTokens:  p.ParseMaxOutputTokens,
		JSONMode:         true,
		NativeSchema:     NativeExerciseSchemaParsedPageBundleWithRuby,
		VisionHighDetail: true,
		ThinkingBudget:   &z,
	})
	if err != nil {
		return nil, err
	}
	text = StripMarkdownFence(text)
	log.Printf("parse one_shot page=%d/%d response_chars=%d preview=%q", pageIndex1, totalPages, len(text), LogPreview(text))

	list, err := decodeParsedPageJSON(text)
	if err != nil {
		return nil, fmt.Errorf("one_shot JSON (page %d/%d): %w\nraw: %s", pageIndex1, totalPages, err, Truncate(text, 500))
	}
	for i := range list {
		log.Printf("parse one_shot page=%d/%d block=%d title=%q passage_chars=%d questions=%d",
			pageIndex1, totalPages, i+1, Truncate(list[i].Title, 60), len(list[i].Passage), len(list[i].Questions))
	}
	return list, nil
}

func (p *OneShotParser) ParseExercisePages(ctx context.Context, pages []ImagePart) ([]ParsedExercise, error) {
	if len(pages) == 0 {
		return nil, errors.New("画像がありません")
	}
	n := len(pages)
	log.Printf("parse one_shot_begin pages=%d (one request per page)", n)
	var perPage [][]ParsedExercise
	for i, page := range pages {
		pe, err := p.parseSinglePage(ctx, page, i+1, n)
		if err != nil {
			return nil, err
		}
		perPage = append(perPage, pe)
	}
	merged := concatParsedPages(perPage)
	if n > 1 && len(merged) > 0 {
		merged = []ParsedExercise{mergeParsedExercisesFromMultiPageScan(merged)}
		log.Printf("parse one_shot_merged_multi_page_pages=%d -> single exercise (questions=%d)", n, len(merged[0].Questions))
	}
	log.Printf("parse one_shot_done exercise_blocks=%d (pages=%d)", len(merged), n)
	return merged, nil
}
