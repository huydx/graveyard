package api

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/huydx/kokugo/internal/ai"
	normunicode "golang.org/x/text/unicode/norm"
)

var htmlTagStripRe = regexp.MustCompile(`<[^>]+>`)
var rtBlockRe = regexp.MustCompile(`(?is)<rt[^>]*>.*?</rt>`)
var rpBlockRe = regexp.MustCompile(`(?is)<rp[^>]*>.*?</rp>`)

func stripHTMLToPlain(s string) string {
	return strings.TrimSpace(htmlTagStripRe.ReplaceAllString(s, ""))
}

// passagePlainForMatch approximates visible reading text: drop furigana (rt/rp) then strip remaining tags.
func passagePlainForMatch(html string) string {
	s := rtBlockRe.ReplaceAllString(html, "")
	s = rpBlockRe.ReplaceAllString(s, "")
	return stripHTMLToPlain(s)
}

func compactPassageMatch(s string) string {
	s = normunicode.NFC.String(s)
	var b strings.Builder
	for _, r := range s {
		// Zero-width / joiners often appear in WebKit selections; drop for stable matching.
		switch r {
		case '\u200b', '\u200c', '\u200d', '\ufeff', '\u2060':
			continue
		}
		if r >= 0xfe00 && r <= 0xfe0f {
			continue
		}
		if !unicode.IsSpace(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func substringLikelyInPassage(sel, pass string) bool {
	if sel == "" {
		return false
	}
	if len(sel) > len(pass) {
		return false
	}
	return strings.Contains(pass, sel)
}

// selectionLikelyFromPassage checks that the user's highlight appears inside the passage (HTML stripped, spaces ignored).
// WebKit (iPad/Safari) Range.toString() often includes <rt> furigana; passagePlainForMatch drops rt, so we also match against
// all text left after stripping tags (document order), which includes readings.
func selectionLikelyFromPassage(selection, passageHTML string) bool {
	sel := compactPassageMatch(strings.TrimSpace(selection))
	if sel == "" {
		return false
	}
	passVisible := compactPassageMatch(passagePlainForMatch(passageHTML))
	passWithReadings := compactPassageMatch(stripHTMLToPlain(passageHTML))
	return substringLikelyInPassage(sel, passVisible) || substringLikelyInPassage(sel, passWithReadings)
}

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
		s.err(w, http.StatusBadRequest, "JSONが不正です")
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
	ex, _, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	passage := strings.TrimSpace(ex.Passage)
	if passage == "" {
		s.err(w, http.StatusBadRequest, "本文がありません")
		return
	}
	if !selectionLikelyFromPassage(sel, passage) {
		s.err(w, http.StatusBadRequest, "選んだ部分が本文の中に見つかりません。もういちどなぞってください")
		return
	}
	rt := s.lm()
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
