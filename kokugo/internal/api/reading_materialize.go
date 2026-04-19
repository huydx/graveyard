package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/huydx/kokugo/internal/ai"
)

// ReadingMaterialize POST turns plain Japanese text into title + ruby passage + questions (Gemini worksheet JSON path).
func (s *Server) ReadingMaterialize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	rt := s.lmFor(UserIDFromCtx(r.Context()))
	osp, ok := rt.imageParser.(*ai.OneShotParser)
	if !ok || osp == nil {
		s.err(w, http.StatusServiceUnavailable, "この機能には演習の画像解析用の Gemini 設定が必要です（API キーをせっていで指定してください）")
		return
	}
	var body struct {
		Title     string `json:"title"`
		PlainText string `json:"plainText"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが読めません")
		return
	}
	pe, err := ai.MaterializeReadingFromPlainText(r.Context(), osp.M, osp.ParseMaxOutputTokens, body.Title, body.PlainText)
	if err != nil {
		log.Printf("reading_materialize: %v", err)
		s.err(w, http.StatusBadGateway, err.Error())
		return
	}
	title := strings.TrimSpace(pe.Title)
	if title == "" {
		title = "読み取り"
	}
	pubQs := make([]map[string]any, 0, len(pe.Questions))
	for _, q := range pe.Questions {
		qt := strings.ToLower(strings.TrimSpace(q.Type))
		if qt != "voice" && qt != "choice" {
			if len(q.Options) >= 2 {
				qt = "choice"
			} else {
				qt = "voice"
			}
		}
		pubQs = append(pubQs, map[string]any{
			"type":          qt,
			"prompt":        q.Prompt,
			"options":       q.Options,
			"correctAnswer": q.Correct,
			"focusWord":     q.FocusWord,
			"scorable":      strings.TrimSpace(q.Correct) != "",
		})
	}
	s.json(w, http.StatusOK, map[string]any{
		"title":     title,
		"passage":   pe.Passage,
		"questions": pubQs,
	})
}
