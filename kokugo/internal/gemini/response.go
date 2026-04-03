package gemini

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"google.golang.org/genai"
)

func extractText(resp *genai.GenerateContentResponse) (string, error) {
	if resp == nil || len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		return "", errors.New("モデルから応答がありません")
	}
	if err := checkMaxTokens(resp); err != nil {
		return "", err
	}
	cand := resp.Candidates[0]
	var b strings.Builder
	for _, p := range cand.Content.Parts {
		if p != nil && p.Text != "" {
			b.WriteString(p.Text)
		}
	}
	s := strings.TrimSpace(b.String())
	if s == "" {
		return "", errors.New("空のテキスト応答")
	}
	return s, nil
}

func checkMaxTokens(resp *genai.GenerateContentResponse) error {
	if resp == nil || len(resp.Candidates) == 0 {
		return nil
	}
	if resp.Candidates[0].FinishReason != genai.FinishReasonMaxTokens {
		return nil
	}
	msg := strings.TrimSpace(resp.Candidates[0].FinishMessage)
	if msg == "" {
		msg = "出力が最大トークンで切れました。プリントが長い場合は画像を分割するか、もう一度お試しください。"
	}
	var extra string
	if resp.UsageMetadata != nil {
		u := resp.UsageMetadata
		extra = fmt.Sprintf(" [prompt=%d candidates=%d thoughts=%d total=%d]",
			u.PromptTokenCount, u.CandidatesTokenCount, u.ThoughtsTokenCount, u.TotalTokenCount)
	}
	return fmt.Errorf("MAX_TOKENS: %s%s", msg, extra)
}

func logUsage(op, model string, resp *genai.GenerateContentResponse) {
	if resp == nil {
		log.Printf("gemini_usage op=%s model=%s usage=nil", op, model)
		return
	}
	mv := resp.ModelVersion
	if mv == "" {
		mv = model
	}
	if resp.UsageMetadata == nil {
		log.Printf("gemini_usage op=%s model=%s version=%s usage=missing", op, model, mv)
		return
	}
	u := resp.UsageMetadata
	log.Printf("gemini_usage op=%s model=%s version=%s prompt=%d candidates=%d total=%d cached=%d thoughts=%d",
		op, model, mv,
		u.PromptTokenCount, u.CandidatesTokenCount, u.TotalTokenCount,
		u.CachedContentTokenCount, u.ThoughtsTokenCount)
}

func ptrFloat32(f float32) *float32 { return &f }
