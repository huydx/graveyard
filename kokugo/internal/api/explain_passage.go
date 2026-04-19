package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/huydx/kokugo/internal/ai"
	"github.com/huydx/kokugo/internal/reading"
)

type explainPassageBody struct {
	Selection string `json:"selection"`
}

// ExplainPassageSelection explains a highlighted part of the exercise passage (uses judge chat = 採点と同じチャット用モデル系).
func (s *Server) ExplainPassageSelection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	var body explainPassageBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが読めません")
		return
	}
	sel := strings.TrimSpace(body.Selection)
	if sel == "" {
		s.err(w, http.StatusBadRequest, "選んだ部分をおくってください")
		return
	}
	if utf8.RuneCountInString(sel) > ai.ExplainSelectionMaxRunes {
		s.err(w, http.StatusBadRequest, "選んだ部分が長すぎます")
		return
	}
	ex, _, err := s.Store.GetExercise(r.Context(), UserIDFromCtx(r.Context()), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	passage := strings.TrimSpace(ex.Passage)
	if passage == "" {
		s.err(w, http.StatusBadRequest, "本文がありません")
		return
	}
	if !reading.SelectionLikelyFromPassage(sel, passage) {
		s.err(w, http.StatusBadRequest, "選んだ部分が本文の中に見つかりません。もういちどなぞってください")
		return
	}
	rt := s.lmFor(UserIDFromCtx(r.Context()))
	if rt.judgeChat == nil {
		s.err(w, http.StatusServiceUnavailable, "説明にはチャット用AI（Gemini または Ollama の採点バックエンド）が必要です")
		return
	}
	log.Printf("explain_passage: exercise_id=%s backend=%s model=%s selection_runes=%d",
		id, rt.effJudgeBackend, rt.judgeModel, utf8.RuneCountInString(sel))
	out, err := ai.ExplainPassageSelection(r.Context(), rt.judgeChat, rt.judgeModel, ex.Title, passage, sel)
	if err != nil {
		log.Printf("explain_passage: FAILED exercise_id=%s err=%v", id, err)
		s.err(w, http.StatusBadGateway, "説明の生成に失敗しました: "+err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{
		"importantKeywords": out.ImportantKeywords,
		"shortMeaning":      out.ShortMeaning,
		"explanation":       out.Explanation,
	})
}

// ExplainReadingSelection explains a highlight for arbitrary passage HTML (no exercise row).
func (s *Server) ExplainReadingSelection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	var body struct {
		Title     string `json:"title"`
		Passage   string `json:"passage"`
		Selection string `json:"selection"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが読めません")
		return
	}
	title := strings.TrimSpace(body.Title)
	passage := strings.TrimSpace(body.Passage)
	sel := strings.TrimSpace(body.Selection)
	if passage == "" {
		s.err(w, http.StatusBadRequest, "passage が必要です")
		return
	}
	if sel == "" {
		s.err(w, http.StatusBadRequest, "selection が必要です")
		return
	}
	if utf8.RuneCountInString(sel) > ai.ExplainSelectionMaxRunes {
		s.err(w, http.StatusBadRequest, "選んだ部分が長すぎます")
		return
	}
	if !reading.SelectionLikelyFromPassage(sel, passage) {
		s.err(w, http.StatusBadRequest, "選んだ部分が本文の中に見つかりません。もういちどなぞってください")
		return
	}
	rt := s.lmFor(UserIDFromCtx(r.Context()))
	if rt.judgeChat == nil {
		s.err(w, http.StatusServiceUnavailable, "説明にはチャット用AI（Gemini または Ollama の採点バックエンド）が必要です")
		return
	}
	out, err := ai.ExplainPassageSelection(r.Context(), rt.judgeChat, rt.judgeModel, title, passage, sel)
	if err != nil {
		s.err(w, http.StatusBadGateway, "説明の生成に失敗しました: "+err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{
		"importantKeywords": out.ImportantKeywords,
		"shortMeaning":      out.ShortMeaning,
		"explanation":       out.Explanation,
	})
}
