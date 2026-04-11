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

// SummarizePrint builds a whole-print summary via JSON chat completion.
func SummarizePrint(ctx context.Context, c ChatCompleter, model string, printPayloadJSON string) (*PrintLearningSummary, error) {
	if c == nil {
		return nil, fmt.Errorf("chat: nil completer")
	}
	user := fmt.Sprintf(PrintSummaryUserTemplate, strings.TrimSpace(printPayloadJSON))
	req := ChatCompletionRequest{
		Model:       model,
		Temperature: 0.35,
		MaxTokens:   8192,
		Messages: []ChatMessage{
			TextMessage("system", PrintSummarySystemJP),
			TextMessage("user", user),
		},
		ResponseFormat:   &ChatResponseFormat{Type: "json_object"},
		GeminiStructured: ChatGeminiStructuredPrintLearningSummary,
	}
	resp, err := c.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, err
	}
	text, err := FirstAssistantContent(resp)
	if err != nil {
		return nil, err
	}
	var out PrintLearningSummary
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("print summary JSON: %w", err)
	}
	NormalizePrintLearningSummary(&out)
	return &out, nil
}

func mathKotsuMaxTokensForPages(n int) int {
	if n <= 1 {
		return 8192
	}
	if n <= 4 {
		return 16384
	}
	return 32768
}

func normalizeMathKotsuSummary(p *MathExerciseKotsuSummary) error {
	p.MainIdea = strings.TrimSpace(p.MainIdea)
	p.Pattern = strings.TrimSpace(p.Pattern)
	trimmed := make([]string, 0, len(p.CarePoints))
	for _, cp := range p.CarePoints {
		cp = strings.TrimSpace(cp)
		if cp == "" {
			continue
		}
		trimmed = append(trimmed, cp)
	}
	p.CarePoints = trimmed
	vis := make([]string, 0, len(p.VisualizationIdeas))
	for _, v := range p.VisualizationIdeas {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		vis = append(vis, v)
	}
	p.VisualizationIdeas = vis
	p.VisualizationHTML = strings.TrimSpace(p.VisualizationHTML)
	if p.MainIdea == "" || p.Pattern == "" || len(p.CarePoints) == 0 {
		return fmt.Errorf("required fields are empty")
	}
	if p.VisualizationHTML == "" {
		return fmt.Errorf("visualization_html is required")
	}
	return nil
}

func kotsuVizHTMLFromRawPage(raw map[string]json.RawMessage) string {
	for _, key := range []string{"visualization_html", "visualizationHtml"} {
		b, ok := raw[key]
		if !ok {
			continue
		}
		var s string
		if json.Unmarshal(b, &s) == nil {
			s = strings.TrimSpace(s)
			if s != "" {
				return s
			}
		}
	}
	return ""
}

// parseMathKotsuPagesResponse parses {"pages":[...]} and normalizes; expectN>0 requires at least that many entries (one per uploaded image minimum when each image has a problem).
func parseMathKotsuPagesResponse(payload string, expectN int) ([]MathExerciseKotsuSummary, error) {
	var wrap struct {
		Pages []MathExerciseKotsuSummary `json:"pages"`
	}
	err := json.Unmarshal([]byte(payload), &wrap)
	if err != nil || len(wrap.Pages) == 0 {
		var rawTop map[string]json.RawMessage
		if json.Unmarshal([]byte(payload), &rawTop) != nil {
			if err != nil {
				return nil, fmt.Errorf("math kotsu JSON: %w", err)
			}
			return nil, fmt.Errorf("math kotsu JSON: missing pages array")
		}
		var found bool
		for _, key := range []string{"pages", "Pages"} {
			b, ok := rawTop[key]
			if !ok {
				continue
			}
			if json.Unmarshal(b, &wrap.Pages) == nil && len(wrap.Pages) > 0 {
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("math kotsu JSON: missing pages array")
		}
	}
	var pageRawMsgs []json.RawMessage
	var envOnly struct {
		Pages []json.RawMessage `json:"pages"`
	}
	if json.Unmarshal([]byte(payload), &envOnly) == nil {
		pageRawMsgs = envOnly.Pages
	}
	for i := range wrap.Pages {
		p := &wrap.Pages[i]
		if normErr := normalizeMathKotsuSummary(p); normErr != nil && i < len(pageRawMsgs) {
			var pr map[string]json.RawMessage
			if json.Unmarshal(pageRawMsgs[i], &pr) == nil {
				if v := kotsuVizHTMLFromRawPage(pr); v != "" {
					p.VisualizationHTML = v
				}
			}
		}
		if err := normalizeMathKotsuSummary(p); err != nil {
			return nil, fmt.Errorf("math kotsu JSON page %d: %w", i+1, err)
		}
	}
	if expectN > 0 && len(wrap.Pages) < expectN {
		return nil, fmt.Errorf("math kotsu JSON: expected at least %d pages, got %d", expectN, len(wrap.Pages))
	}
	return wrap.Pages, nil
}

// SummarizeMathExerciseKotsuPages returns one summary per distinct math problem on the scan (page order, then visual order within each page). Multiple problems on one image yield multiple elements.
func SummarizeMathExerciseKotsuPages(ctx context.Context, c ChatCompleter, model string, pages []ImagePart) ([]MathExerciseKotsuSummary, error) {
	if c == nil {
		return nil, fmt.Errorf("chat: nil completer")
	}
	n := len(pages)
	if n == 0 {
		return nil, fmt.Errorf("ページ画像がありません")
	}
	userText := fmt.Sprintf(MathKotsuUserPages, n, n, n)
	parts := []ChatContentPart{{Type: "text", Text: userText}}
	for _, p := range pages {
		mime := p.MIME
		if mime == "" || mime == "application/octet-stream" {
			mime = "image/jpeg"
		}
		if len(p.Data) == 0 {
			return nil, fmt.Errorf("画像データが空です")
		}
		parts = append(parts, ChatContentPart{
			Type:     "image_url",
			ImageURL: &ChatImageURL{URL: EncodeImageDataURL(mime, p.Data), Detail: "high"},
		})
	}
	req := ChatCompletionRequest{
		Model:            model,
		Temperature:      0.2,
		MaxTokens:        mathKotsuMaxTokensForPages(n),
		Messages:         []ChatMessage{TextMessage("system", MathKotsuSystem), {Role: "user", Content: parts}},
		ResponseFormat:   &ChatResponseFormat{Type: "json_object"},
		GeminiStructured: ChatGeminiStructuredMathExerciseKotsu,
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
	payload := text
	out, err := parseMathKotsuPagesResponse(payload, n)
	if err != nil {
		sub, exErr := ExtractFirstJSONObject(text)
		if exErr != nil {
			return nil, err
		}
		payload = sub
		out, err = parseMathKotsuPagesResponse(payload, n)
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

// SummarizeMathExerciseKotsu is one image → delegates to SummarizeMathExerciseKotsuPages (may return multiple entries if the image contains several problems).
func SummarizeMathExerciseKotsu(ctx context.Context, c ChatCompleter, model string, image []byte, mime string) ([]MathExerciseKotsuSummary, error) {
	if len(image) == 0 {
		return nil, fmt.Errorf("画像データが空です")
	}
	if mime == "" || mime == "application/octet-stream" {
		mime = "image/jpeg"
	}
	return SummarizeMathExerciseKotsuPages(ctx, c, model, []ImagePart{{Data: image, MIME: mime}})
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

// ExplainPassageMaxRunes caps passage HTML length for explain + speed-read bunsetsu calls.
const ExplainPassageMaxRunes = 9000

// ExplainSelectionMaxRunes is the maximum rune length accepted for a passage highlight.
const ExplainSelectionMaxRunes = 400

// ExplainPassageSelection explains a user-highlighted slice using full passage context (same chat stack as scoring).
func ExplainPassageSelection(ctx context.Context, c ChatCompleter, model, title, passageHTML, selection string) (*PassageSelectionExplain, error) {
	if c == nil {
		return nil, fmt.Errorf("chat: nil completer")
	}
	sel := strings.TrimSpace(selection)
	if sel == "" {
		return nil, fmt.Errorf("選んだ部分が空です")
	}
	if utf8.RuneCountInString(sel) > ExplainSelectionMaxRunes {
		return nil, fmt.Errorf("選んだ部分が長すぎます（最大%d文字）", ExplainSelectionMaxRunes)
	}
	pass := strings.TrimSpace(passageHTML)
	if pass == "" {
		return nil, fmt.Errorf("本文がありません")
	}
	if utf8.RuneCountInString(pass) > ExplainPassageMaxRunes {
		var b strings.Builder
		n := 0
		for _, r := range pass {
			if n >= ExplainPassageMaxRunes {
				b.WriteString("…")
				break
			}
			b.WriteRune(r)
			n++
		}
		pass = b.String()
	}
	user := fmt.Sprintf(explainPassageSelectionUserTemplate,
		strings.TrimSpace(title),
		pass,
		sel,
	)
	req := ChatCompletionRequest{
		Model:       model,
		Temperature: 0.25,
		MaxTokens:   2048,
		Messages: []ChatMessage{
			TextMessage("system", explainPassageSelectionSystem),
			TextMessage("user", user),
		},
		ResponseFormat:   &ChatResponseFormat{Type: "json_object"},
		GeminiStructured: ChatGeminiStructuredPassageSelectionExplain,
	}
	resp, err := c.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("explain completion: %w", err)
	}
	text, err := FirstAssistantContent(resp)
	if err != nil {
		return nil, fmt.Errorf("explain assistant: %w", err)
	}
	text = StripMarkdownFence(text)
	var out PassageSelectionExplain
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("explain JSON: %w", err)
	}
	out.ShortMeaning = strings.TrimSpace(out.ShortMeaning)
	out.Explanation = strings.TrimSpace(out.Explanation)
	trimmedKW := make([]string, 0, len(out.ImportantKeywords))
	for _, k := range out.ImportantKeywords {
		k = strings.TrimSpace(k)
		if k != "" {
			trimmedKW = append(trimmedKW, k)
		}
	}
	out.ImportantKeywords = trimmedKW
	if out.ShortMeaning == "" || out.Explanation == "" {
		return nil, fmt.Errorf("explain JSON: required fields are empty")
	}
	return &out, nil
}

const bunsetsuSystem = `あなたは小学校向け国語の先生です。与えられた本文（表示用のプレーンテキスト）を「文節」（ぶんせつ）に分け、JSONオブジェクト1つだけを返します。

【出力形式】{"segments":["文節1","文節2",...]} のみ。ほかのキー、説明文、マークダウン、コードフェンスは禁止。

【文節】助詞・助動詞は前にくっつける（例:「学校へ」「きれいだった」「読んでいた」）。意味のまとまりと読みのくぎりを優先する。

【厳守】segments の各要素を順につなげると、入力本文と文字どおり一致すること。空白や改行の追加、表記の変更、文字の省略・追加は禁止。`

// SegmentPassageBunsetsu splits visible passage text into bunsetsu via the given chat completer (e.g. summary stack).
func SegmentPassageBunsetsu(ctx context.Context, c ChatCompleter, model, visiblePlain string) ([]string, error) {
	if c == nil {
		return nil, fmt.Errorf("chat: nil completer")
	}
	vis := strings.TrimSpace(visiblePlain)
	if vis == "" {
		return nil, fmt.Errorf("本文が空です")
	}
	if utf8.RuneCountInString(vis) > ExplainPassageMaxRunes {
		return nil, fmt.Errorf("本文が長すぎます（最大%d文字）", ExplainPassageMaxRunes)
	}
	user := "【本文】\n" + vis + "\n\n上記を文節に分け、system の形式どおりの JSON だけを返してください。"
	req := ChatCompletionRequest{
		Model:       model,
		Temperature: 0.15,
		MaxTokens:   8192,
		Messages: []ChatMessage{
			TextMessage("system", bunsetsuSystem),
			TextMessage("user", user),
		},
		ResponseFormat: &ChatResponseFormat{Type: "json_object"},
		// No Gemini native schema: large array schemas often return 400 INVALID_ARGUMENT; prompt defines shape.
		GeminiStructured: ChatGeminiStructuredNone,
	}
	resp, err := c.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("bunsetsu completion: %w", err)
	}
	text, err := FirstAssistantContent(resp)
	if err != nil {
		return nil, fmt.Errorf("bunsetsu assistant: %w", err)
	}
	text = StripMarkdownFence(text)
	jsonObj, err := ExtractFirstJSONObject(text)
	if err != nil {
		return nil, fmt.Errorf("bunsetsu JSON: %w", err)
	}
	var raw struct {
		Segments []string `json:"segments"`
	}
	if err := json.Unmarshal([]byte(jsonObj), &raw); err != nil {
		return nil, fmt.Errorf("bunsetsu JSON: %w", err)
	}
	out := make([]string, 0, len(raw.Segments))
	for _, s := range raw.Segments {
		if strings.TrimSpace(s) == "" {
			continue
		}
		out = append(out, s)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("bunsetsu JSON: segments が空です")
	}
	return out, nil
}
