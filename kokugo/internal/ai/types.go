package ai

import (
	"encoding/json"
	"strings"
)

// ImagePart is one page or image blob passed to vision-capable models.
type ImagePart struct {
	Data []byte
	MIME string
}

// ContentPart is one segment of a worksheet-parse turn: text and/or an inline image.
type ContentPart struct {
	Text  string
	Image *ImagePart
}

// ParsedExercise is structured exercise content after image parsing.
type ParsedExercise struct {
	Title     string           `json:"title"`
	Passage   string           `json:"passage"`
	Questions []ParsedQuestion `json:"questions"`
}

// ParsedQuestion is one question from a parsed exercise.
type ParsedQuestion struct {
	Type      string   `json:"type"`
	Prompt    string   `json:"prompt"`
	Options   []string `json:"options"`
	Correct   string   `json:"correct"`
	FocusWord string   `json:"focus_word"`
}

// LearningSummary is the legacy per-exercise shape (no longer written by the API).
type LearningSummary struct {
	KeyPoints  []string       `json:"key_points"`
	Vocabulary []VocabSummary `json:"vocabulary"`
}

// PrintKeywordCard is one flashcard line: short phrase (front) and its explanation (back).
type PrintKeywordCard struct {
	Phrase string `json:"phrase"`
	Nuance string `json:"nuance"`
}

// PrintLearningSummary is one AI summary for a whole print (assignment).
type PrintLearningSummary struct {
	Overview     string             `json:"overview"`
	KeywordCards []PrintKeywordCard `json:"keyword_cards"`
}

// MathExerciseKotsuSummary is a kid-friendly tips summary for one math exercise image.
type MathExerciseKotsuSummary struct {
	MainIdea           string   `json:"main_idea"`
	Pattern            string   `json:"pattern"`
	CarePoints         []string `json:"care_points"`
	VisualizationIdeas []string `json:"visualization_ideas,omitempty"`
	VisualizationHTML  string   `json:"visualization_html,omitempty"`
}

// UnmarshalJSON accepts current "keyword_cards" or legacy "keywords_nuances" ([]string).
func (s *PrintLearningSummary) UnmarshalJSON(data []byte) error {
	type legacy struct {
		Overview        string             `json:"overview"`
		KeywordCards    []PrintKeywordCard `json:"keyword_cards"`
		KeywordsNuances []string           `json:"keywords_nuances"`
	}
	var l legacy
	if err := json.Unmarshal(data, &l); err != nil {
		return err
	}
	s.Overview = strings.TrimSpace(l.Overview)
	if len(l.KeywordCards) > 0 {
		s.KeywordCards = l.KeywordCards
		return nil
	}
	for _, line := range l.KeywordsNuances {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		s.KeywordCards = append(s.KeywordCards, PrintKeywordCard{Phrase: line, Nuance: ""})
	}
	return nil
}

// VocabSummary is one vocabulary entry in a learning summary.
type VocabSummary struct {
	Word     string   `json:"word"`
	Reading  string   `json:"reading"`
	Meaning  string   `json:"meaning"`
	Examples []string `json:"examples"`
}

// AnswerJudgeItem is one question payload for answer judging.
type AnswerJudgeItem struct {
	ID         string   `json:"id"`
	Type       string   `json:"type"`
	Prompt     string   `json:"prompt"`
	Options    []string `json:"options,omitempty"`
	Correct    string   `json:"correct"`
	UserAnswer string   `json:"user_answer"`
}

// AnswerJudgment is one scored answer from the judge model (or legacy compare).
type AnswerJudgment struct {
	QuestionID string `json:"questionId"`
	IsCorrect  bool   `json:"isCorrect"`
	Feedback   string `json:"feedback"`
}
