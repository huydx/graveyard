package reading

import (
	"context"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/huydx/kokugo/internal/ai"
	normunicode "golang.org/x/text/unicode/norm"
)

// SpeedReadHTTPError is returned from ComputeSpeedReadHTMLSegments for HTTP-friendly handling.
type SpeedReadHTTPError struct {
	Status int
	Msg    string
}

func (e SpeedReadHTTPError) Error() string { return e.Msg }

// ComputeSpeedReadHTMLSegments runs AI bunsetsu segmentation + merge + HTML mapping for any passage HTML.
func ComputeSpeedReadHTMLSegments(ctx context.Context, summaryChat ai.ChatCompleter, summaryModel, passage string) ([]string, error) {
	passage = strings.TrimSpace(passage)
	if utf8.RuneCountInString(passage) > ai.ExplainPassageMaxRunes {
		return nil, SpeedReadHTTPError{Status: http.StatusBadRequest, Msg: "本文が長すぎます"}
	}
	vis, atoms, err := PassageSpeedReadVisibleAndAtoms(passage)
	if err != nil {
		return nil, SpeedReadHTTPError{Status: http.StatusBadRequest, Msg: "本文のHTMLを読めませんでした"}
	}
	if strings.TrimSpace(vis) == "" {
		return []string{}, nil
	}
	want := strings.TrimSpace(PassagePlainForMatch(passage))
	if normunicode.NFC.String(want) != normunicode.NFC.String(vis) {
		return nil, SpeedReadHTTPError{Status: http.StatusInternalServerError, Msg: "本文の解析に失敗しました"}
	}
	if summaryChat == nil {
		return nil, SpeedReadHTTPError{Status: http.StatusServiceUnavailable, Msg: "速読の文節分けにはチャット用AI（まとめと同じ Gemini または Ollama）が必要です"}
	}
	modelSegs, err := ai.SegmentPassageBunsetsu(ctx, summaryChat, summaryModel, vis)
	if err != nil {
		return nil, SpeedReadHTTPError{Status: http.StatusBadGateway, Msg: "文節分けに失敗しました: " + err.Error()}
	}
	merged, err := MergeBunsetsuCutsAtRuby([]rune(vis), atoms, modelSegs)
	if err != nil {
		return nil, SpeedReadHTTPError{Status: http.StatusBadGateway, Msg: "文節の位置ぞろえに失敗しました。もう一度おためしください。"}
	}
	htmlSegs, err := MapSpeedReadSegmentsToHTML(passage, merged)
	if err != nil {
		return nil, SpeedReadHTTPError{Status: http.StatusBadGateway, Msg: "表示用の分割に失敗しました"}
	}
	return htmlSegs, nil
}
