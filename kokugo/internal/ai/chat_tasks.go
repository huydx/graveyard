package ai

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
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
	if len(passageTrim) > 2000 {
		passageTrim = passageTrim[:2000] + "…"
	}
	user := fmt.Sprintf(JudgeAnswersUserTemplate,
		strings.TrimSpace(title),
		passageTrim,
		string(itemsJSON),
	)
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
		return nil, err
	}
	text, err := FirstAssistantContent(resp)
	if err != nil {
		return nil, err
	}
	text = StripMarkdownFence(text)
	var parsed struct {
		Results []struct {
			QuestionID string `json:"question_id"`
			IsCorrect  bool   `json:"is_correct"`
			Feedback   string `json:"feedback"`
		} `json:"results"`
	}
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return nil, fmt.Errorf("judge JSON: %w", err)
	}
	byID := make(map[string]AnswerJudgment, len(parsed.Results))
	for _, r := range parsed.Results {
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
