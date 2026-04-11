package api

import (
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/huydx/kokugo/internal/ai"
	normunicode "golang.org/x/text/unicode/norm"
)

// SpeedReadSegments returns passage HTML split into bunsetsu-sized chunks (same chat stack as print summary).
func (s *Server) SpeedReadSegments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.err(w, http.StatusMethodNotAllowed, "GET のみ")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	ex, _, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	passage := strings.TrimSpace(ex.Passage)
	if passage == "" {
		s.json(w, http.StatusOK, map[string]any{"htmlSegments": []string{}})
		return
	}
	if utf8.RuneCountInString(passage) > ai.ExplainPassageMaxRunes {
		s.err(w, http.StatusBadRequest, "本文が長すぎます")
		return
	}
	vis, atoms, err := PassageSpeedReadVisibleAndAtoms(passage)
	if err != nil {
		log.Printf("speed_read_segments: visible parse id=%s err=%v", id, err)
		s.err(w, http.StatusBadRequest, "本文のHTMLを読めませんでした")
		return
	}
	if strings.TrimSpace(vis) == "" {
		s.json(w, http.StatusOK, map[string]any{"htmlSegments": []string{}})
		return
	}
	want := strings.TrimSpace(passagePlainForMatch(passage))
	if normunicode.NFC.String(want) != normunicode.NFC.String(vis) {
		log.Printf("speed_read_segments: visible mismatch id=%s parsed=%q plain=%q", id, vis, want)
		s.err(w, http.StatusInternalServerError, "本文の解析に失敗しました")
		return
	}
	rt := s.lm()
	if rt.summaryChat == nil {
		s.err(w, http.StatusServiceUnavailable, "速読の文節分けにはチャット用AI（まとめと同じ Gemini または Ollama）が必要です")
		return
	}
	log.Printf("speed_read_segments: exercise_id=%s backend=%s model=%s visible_runes=%d",
		id, rt.effSummaryBackend, rt.summaryModel, utf8.RuneCountInString(vis))
	modelSegs, err := ai.SegmentPassageBunsetsu(r.Context(), rt.summaryChat, rt.summaryModel, vis)
	if err != nil {
		log.Printf("speed_read_segments: AI id=%s err=%v", id, err)
		s.err(w, http.StatusBadGateway, "文節分けに失敗しました: "+err.Error())
		return
	}
	merged, err := mergeBunsetsuCutsAtRuby([]rune(vis), atoms, modelSegs)
	if err != nil {
		log.Printf("speed_read_segments: merge id=%s err=%v — using whole passage as one segment", id, err)
		merged = []string{vis}
	}
	htmlSegs, err := MapSpeedReadSegmentsToHTML(passage, merged)
	if err != nil {
		log.Printf("speed_read_segments: map id=%s err=%v", id, err)
		s.err(w, http.StatusBadGateway, "表示用の分割に失敗しました")
		return
	}
	s.json(w, http.StatusOK, map[string]any{"htmlSegments": htmlSegs})
}
