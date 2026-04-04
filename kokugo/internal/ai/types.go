package ai

import "context"

// ImagePart is one page or image blob passed to vision-capable models.
type ImagePart struct {
	Data []byte
	MIME string
}

// PageOCR extracts plain text from one worksheet image (e.g. remote PaddleOCR HTTP API).
type PageOCR interface {
	ExtractText(ctx context.Context, page ImagePart) (string, error)
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

// LearningSummary is returned by post-exercise summarization.
type LearningSummary struct {
	KeyPoints  []string       `json:"key_points"`
	Vocabulary []VocabSummary `json:"vocabulary"`
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
