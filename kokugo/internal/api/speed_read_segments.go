package api

import (
	"context"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/huydx/kokugo/internal/ai"
	normunicode "golang.org/x/text/unicode/norm"
)

// SpeedReadSegments GET returns cached bunsetsu HTML only (no AI). POST generates, saves to DB, and returns segments.
func (s *Server) SpeedReadSegments(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.speedReadSegmentsGET(w, r)
	case http.MethodPost:
		s.speedReadSegmentsPOST(w, r)
	default:
		s.err(w, http.StatusMethodNotAllowed, "GET または POST のみです")
	}
}

func (s *Server) speedReadSegmentsGET(w http.ResponseWriter, r *http.Request) {
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
	if len(ex.SpeedReadHTMLSegments) > 0 {
		s.json(w, http.StatusOK, map[string]any{"htmlSegments": ex.SpeedReadHTMLSegments})
		return
	}
	s.json(w, http.StatusOK, map[string]any{"htmlSegments": []string{}})
}

func (s *Server) speedReadSegmentsPOST(w http.ResponseWriter, r *http.Request) {
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
	if len(ex.SpeedReadHTMLSegments) > 0 {
		s.json(w, http.StatusOK, map[string]any{"htmlSegments": ex.SpeedReadHTMLSegments})
		return
	}
	passage := strings.TrimSpace(ex.Passage)
	if passage == "" {
		s.json(w, http.StatusOK, map[string]any{"htmlSegments": []string{}})
		return
	}
	htmlSegs, err := s.computeSpeedReadHTMLSegments(r.Context(), id, passage)
	if err != nil {
		if h, ok := err.(errSpeedReadHTTP); ok {
			s.err(w, h.status, h.msg)
			return
		}
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(htmlSegs) == 0 {
		s.json(w, http.StatusOK, map[string]any{"htmlSegments": []string{}})
		return
	}
	if err := s.Store.SaveSpeedReadSegments(r.Context(), ex.ID, ex.Passage, htmlSegs); err != nil {
		log.Printf("speed_read_segments: save id=%s err=%v", id, err)
		s.err(w, http.StatusInternalServerError, "文節の保存に失敗しました")
		return
	}
	s.json(w, http.StatusOK, map[string]any{"htmlSegments": htmlSegs})
}

// computeSpeedReadHTMLSegments runs AI + merge + HTML mapping. Caller handles HTTP errors via sentinel.
func (s *Server) computeSpeedReadHTMLSegments(ctx context.Context, id, passage string) ([]string, error) {
	if utf8.RuneCountInString(passage) > ai.ExplainPassageMaxRunes {
		return nil, errSpeedReadHTTP{status: http.StatusBadRequest, msg: "本文が長すぎます"}
	}
	vis, atoms, err := PassageSpeedReadVisibleAndAtoms(passage)
	if err != nil {
		log.Printf("speed_read_segments: visible parse id=%s err=%v", id, err)
		return nil, errSpeedReadHTTP{status: http.StatusBadRequest, msg: "本文のHTMLを読めませんでした"}
	}
	if strings.TrimSpace(vis) == "" {
		return []string{}, nil
	}
	want := strings.TrimSpace(passagePlainForMatch(passage))
	if normunicode.NFC.String(want) != normunicode.NFC.String(vis) {
		log.Printf("speed_read_segments: visible mismatch id=%s parsed=%q plain=%q", id, vis, want)
		return nil, errSpeedReadHTTP{status: http.StatusInternalServerError, msg: "本文の解析に失敗しました"}
	}
	rt := s.lm()
	if rt.summaryChat == nil {
		return nil, errSpeedReadHTTP{status: http.StatusServiceUnavailable, msg: "速読の文節分けにはチャット用AI（まとめと同じ Gemini または Ollama）が必要です"}
	}
	log.Printf("speed_read_segments: exercise_id=%s backend=%s model=%s visible_runes=%d",
		id, rt.effSummaryBackend, rt.summaryModel, utf8.RuneCountInString(vis))
	modelSegs, err := ai.SegmentPassageBunsetsu(ctx, rt.summaryChat, rt.summaryModel, vis)
	if err != nil {
		log.Printf("speed_read_segments: AI id=%s err=%v", id, err)
		return nil, errSpeedReadHTTP{status: http.StatusBadGateway, msg: "文節分けに失敗しました: " + err.Error()}
	}
	merged, err := mergeBunsetsuCutsAtRuby([]rune(vis), atoms, modelSegs)
	if err != nil {
		log.Printf("speed_read_segments: merge id=%s err=%v", id, err)
		return nil, errSpeedReadHTTP{status: http.StatusBadGateway, msg: "文節の位置ぞろえに失敗しました。もう一度おためしください。"}
	}
	htmlSegs, err := MapSpeedReadSegmentsToHTML(passage, merged)
	if err != nil {
		log.Printf("speed_read_segments: map id=%s err=%v", id, err)
		return nil, errSpeedReadHTTP{status: http.StatusBadGateway, msg: "表示用の分割に失敗しました"}
	}
	return htmlSegs, nil
}

type errSpeedReadHTTP struct {
	status int
	msg    string
}

func (e errSpeedReadHTTP) Error() string { return e.msg }
