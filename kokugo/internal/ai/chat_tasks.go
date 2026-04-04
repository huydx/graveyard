package ai

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"unicode/utf8"
)

// TranscribeAnswerAudio runs speech-to-text via ChatCompletion (multimodal user message).
func TranscribeAnswerAudio(ctx context.Context, c ChatCompleter, model string, audio []byte, mime string) (string, error) {
	if c == nil {
		return "", fmt.Errorf("chat: nil completer")
	}
	if len(audio) == 0 {
		return "", fmt.Errorf("音声データが空です")
	}
	if mime == "" || mime == "application/octet-stream" {
		mime = "audio/mp4"
	}
	req := ChatCompletionRequest{
		Model:       model,
		Temperature: 0.1,
		MaxTokens:   512,
		Messages: []ChatMessage{{
			Role: "user",
			Content: []ChatContentPart{
				{Type: "text", Text: TranscribePrompt},
				{Type: "input_audio", InputAudio: &ChatInputAudio{Data: audio, MIME: mime}},
			},
		}},
	}
	resp, err := c.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", err
	}
	return FirstAssistantContent(resp)
}

// SummarizeLearning builds a post-exercise summary via JSON chat completion.
func SummarizeLearning(ctx context.Context, c ChatCompleter, model string, title, passage, questionsJSON string, scorePercent int) (*LearningSummary, error) {
	if c == nil {
		return nil, fmt.Errorf("chat: nil completer")
	}
	user := fmt.Sprintf(SummaryUserTemplate,
		strings.TrimSpace(title),
		strings.TrimSpace(passage),
		strings.TrimSpace(questionsJSON),
		scorePercent,
	)
	req := ChatCompletionRequest{
		Model:       model,
		Temperature: 0.4,
		MaxTokens:   8192,
		Messages: []ChatMessage{
			TextMessage("system", SummarySystemJP),
			TextMessage("user", user),
		},
		ResponseFormat:   &ChatResponseFormat{Type: "json_object"},
		GeminiStructured: ChatGeminiStructuredLearningSummary,
	}
	resp, err := c.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, err
	}
	text, err := FirstAssistantContent(resp)
	if err != nil {
		return nil, err
	}
	var out LearningSummary
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("summary JSON: %w", err)
	}
	return &out, nil
}

func truncateJudgeLog(s string, maxRunes int) string {
	s = strings.TrimSpace(s)
	if maxRunes <= 0 {
		return ""
	}
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	var b strings.Builder
	n := 0
	for _, r := range s {
		if n >= maxRunes {
			break
		}
		b.WriteRune(r)
		n++
	}
	return b.String() + "…"
}

// JudgeExerciseAnswers scores answers via JSON chat completion. Results are ordered like items; any missing id is treated incorrect.
func JudgeExerciseAnswers(ctx context.Context, c ChatCompleter, model string, title, passage string, items []AnswerJudgeItem) ([]AnswerJudgment, error) {
	if c == nil {
		return nil, fmt.Errorf("chat: nil completer")
	}
	if len(items) == 0 {
		return nil, nil
	}
	itemsJSON, err := json.Marshal(items)
	if err != nil {
		return nil, err
	}
	passageTrim := strings.TrimSpace(passage)
	passageSent := passageTrim
	if len(passageTrim) > 2000 {
		passageSent = passageTrim[:2000] + "…"
	}
	user := fmt.Sprintf(JudgeAnswersUserTemplate,
		strings.TrimSpace(title),
		passageSent,
		string(itemsJSON),
	)
	log.Printf("judge_answers: request model=%s items=%d title_runes=%d passage_runes=%d user_prompt_runes=%d items_json_bytes=%d",
		model, len(items), utf8.RuneCountInString(title), utf8.RuneCountInString(passageTrim), utf8.RuneCountInString(user), len(itemsJSON))
	req := ChatCompletionRequest{
		Model:       model,
		Temperature: 0.1,
		MaxTokens:   4096,
		Messages: []ChatMessage{
			TextMessage("system", JudgeAnswersSystem),
			TextMessage("user", user),
		},
		ResponseFormat:   &ChatResponseFormat{Type: "json_object"},
		GeminiStructured: ChatGeminiStructuredAnswerJudgment,
	}
	resp, err := c.CreateChatCompletion(ctx, req)
	if err != nil {
		log.Printf("judge_answers: CreateChatCompletion failed model=%s items=%d err=%v", model, len(items), err)
		return nil, fmt.Errorf("judge completion: %w", err)
	}
	text, err := FirstAssistantContent(resp)
	if err != nil {
		log.Printf("judge_answers: assistant content missing model=%s items=%d err=%v", model, len(items), err)
		return nil, fmt.Errorf("judge assistant: %w", err)
	}
	text = StripMarkdownFence(text)
	parsedRows, err := parseJudgeResultsJSON(text)
	if err != nil {
		log.Printf("judge_answers: JSON parse failed model=%s items=%d assistant_runes=%d snippet=%q err=%v",
			model, len(items), utf8.RuneCountInString(text), truncateJudgeLog(text, 320), err)
		return nil, fmt.Errorf("judge JSON: %w", err)
	}
	if len(parsedRows) == 0 && len(items) > 0 {
		log.Printf("judge_answers: warning model=%s requested_items=%d but JSON results empty snippet=%q",
			model, len(items), truncateJudgeLog(text, 400))
	} else if len(parsedRows) != len(items) {
		log.Printf("judge_answers: warning model=%s requested_items=%d parsed_results=%d (unmatched question_id → incorrect)",
			model, len(items), len(parsedRows))
	}
	log.Printf("judge_answers: ok model=%s items=%d parsed_results=%d", model, len(items), len(parsedRows))
	byID := make(map[string]AnswerJudgment, len(parsedRows))
	for _, r := range parsedRows {
		if r.QuestionID == "" {
			continue
		}
		fb := strings.TrimSpace(r.Feedback)
		if fb == "" {
			if r.IsCorrect {
				fb = "せいかい！よくできました。"
			} else {
				fb = "まだちがうみたい。またよんでみよう。"
			}
		}
		byID[r.QuestionID] = AnswerJudgment{QuestionID: r.QuestionID, IsCorrect: r.IsCorrect, Feedback: fb}
	}
	out := make([]AnswerJudgment, 0, len(items))
	for _, it := range items {
		if j, ok := byID[it.ID]; ok {
			out = append(out, j)
			continue
		}
		out = append(out, AnswerJudgment{
			QuestionID: it.ID,
			IsCorrect:  false,
			Feedback:   "さいてんのけっかがとれませんでした。もういちどためしてね。",
		})
	}
	return out, nil
}

// EncodeImageDataURL builds a data URL for ChatImageURL from raw image bytes.
func EncodeImageDataURL(mime string, data []byte) string {
	if mime == "" {
		mime = "image/jpeg"
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
}
