package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/huydx/kokugo/internal/reading"
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
	ex, _, err := s.Store.GetExercise(r.Context(), UserIDFromCtx(r.Context()), id)
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
	ex, _, err := s.Store.GetExercise(r.Context(), UserIDFromCtx(r.Context()), id)
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
	rt := s.lmFor(UserIDFromCtx(r.Context()))
	htmlSegs, err := reading.ComputeSpeedReadHTMLSegments(r.Context(), rt.summaryChat, rt.summaryModel, passage)
	if err != nil {
		var re reading.SpeedReadHTTPError
		if errors.As(err, &re) {
			s.err(w, re.Status, re.Msg)
			return
		}
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(htmlSegs) == 0 {
		s.json(w, http.StatusOK, map[string]any{"htmlSegments": []string{}})
		return
	}
	if err := s.Store.SaveSpeedReadSegments(r.Context(), UserIDFromCtx(r.Context()), ex.ID, ex.Passage, htmlSegs); err != nil {
		log.Printf("speed_read_segments: save id=%s err=%v", id, err)
		s.err(w, http.StatusInternalServerError, "文節の保存に失敗しました")
		return
	}
	s.json(w, http.StatusOK, map[string]any{"htmlSegments": htmlSegs})
}

// ReadingSpeedReadSegments POST generates bunsetsu HTML segments for arbitrary passage text (no DB cache).
func (s *Server) ReadingSpeedReadSegments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	var body struct {
		Passage string `json:"passage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが読めません")
		return
	}
	passage := strings.TrimSpace(body.Passage)
	if passage == "" {
		s.json(w, http.StatusOK, map[string]any{"htmlSegments": []string{}})
		return
	}
	rt := s.lmFor(UserIDFromCtx(r.Context()))
	htmlSegs, err := reading.ComputeSpeedReadHTMLSegments(r.Context(), rt.summaryChat, rt.summaryModel, passage)
	if err != nil {
		var re reading.SpeedReadHTTPError
		if errors.As(err, &re) {
			s.err(w, re.Status, re.Msg)
			return
		}
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{"htmlSegments": htmlSegs})
}
