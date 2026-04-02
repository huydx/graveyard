package gemini

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"google.golang.org/genai"
)

const geminiDocMaxOutputTokens int32 = 65536

// ---------------------------------------------------------------------------
// Prompts — 3-step pipeline: (1) OCR  (2) structure  (3) ruby
// ---------------------------------------------------------------------------

const step1OCRSystem = `あなたは日本語のOCRアシスタントです。画像に写っている文字を読み取ります。
プレーンテキストだけを出力してください。
- JSON・HTML・マークダウン・ふりがな（ruby）は付けない。
- 改行は読みやすいように保つ。
- 推測は最小限。読めない部分は空行のままか [?] とする。
- 説明文や「以下は…」などの前置きは書かない。`

const step1OCRSingleUser = `この画像に写っている教材の文字をすべて書き写してください。`

const step1OCRPageUser = `これは教材の %d / 全 %d ページ目です。このページに写っている文字をすべて書き写してください。他ページの内容は含めないでください。`

const step2StructureSystem = `あなたは小学校の国語の先生です。与えられたプリントのテキストから教材データをJSONだけで返します。
漢字にはまだふりがなを付けない。プレーンテキストの日本語のみ。HTMLタグは禁止（voice の correct はひらがな中心のプレーンテキスト）。`

const step2StructureUser = `次のテキストはプリントの読み取り結果です。JSONスキーマに従って構造化してください。

--- プリントテキスト ---
%s
---

ルール:
- type が voice のときは options は空配列。correct はひらがな中心のプレーンテキストのみ（タグ禁止）。
- type が choice のときは4択、options に4つ、correct は正解と同じ文字列（プレーン日本語、ruby なし）。
- 問題は最大12問まで（重要な設問から）。
- passage は約1200文字以内の要約。長文の注意書きは省いてよい。
- title / passage / prompt / options はすべてプレーン日本語（ruby 禁止）。`

const step3RubySystem = `あなたは小学校向け国語教材の編集者です。与えられたJSONの日本語に、子ども向けのふりがな（HTMLの ruby）だけを追加してください。
JSONのキー名・構造・配列の順序・問題の個数は変えない。`

const step3RubyUser = `次のJSONを、同じ構造のまま返してください。変更点は次のとおり:
- title, passage, questions[].prompt, questions[].options[], questions[].focus_word の日本語の漢字に <ruby>漢字<rt>よみ</rt></ruby> を付ける。
- ひらがな・カタカナのみの語には ruby 不要。
- questions[].type が voice の **correct** は読み上げ用のため、**ひらがなのまま**（ruby も HTML も付けない）。
- questions[].type が choice の **correct** は options のいずれかと同じ文字列にし、**ruby 付きHTML**でよい。
長い本文では文または短い節ごとに1つの ruby にまとめてよい。

--- 入力JSON ---
%s
---`

// ---------------------------------------------------------------------------
// Summary prompt (separate from the parse pipeline)
// ---------------------------------------------------------------------------

const summarySystemJP = `あなたは小学校低学年向けの国語教師です。学習のまとめをJSONだけで返します。
出力する日本語のすべての漢字に、<ruby>漢字<rt>かんじ</rt></ruby> 形式のふりがなを付けてください（ひらがなのみの語は不要）。`

const summaryUserTemplate = `以下の教材タイトル・本文・設問と、子どもの解答状況を踏まえて学習のまとめを作ってください。
タイトル: %s
本文:
%s
設問一覧(JSON): %s
正答率の目安: %d%%

次のJSONだけを返してください:
{
  "key_points": ["この教材でおさえたいポイントを短く2〜5個"],
  "vocabulary": [
    {
      "word": "語",
      "reading": "よみ（ひらがな）",
      "meaning": "意味（子ども向けに短く）",
      "examples": ["使い方の例文1", "例文2"]
    }
  ]
}
語彙は3〜8語程度。教材に出てくる語を優先し、それぞれ例文は2つ。
word / meaning / examples / key_points の日本語には、漢字に必ず ruby を付ける。reading は「word のふりがな（ひらがな）」のため、word の rt と同じ内容でよい。`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Client struct {
	genai                *genai.Client
	model                string
	parseMaxOutputTokens int32
}

func New(ctx context.Context, apiKey, model string, parseMaxOutputTokens int32) (*Client, error) {
	if apiKey == "" {
		return nil, errors.New("GOOGLE_API_KEY が空です")
	}
	c, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, err
	}
	if model == "" {
		model = "gemini-2.5-flash"
	}
	if parseMaxOutputTokens <= 0 {
		parseMaxOutputTokens = geminiDocMaxOutputTokens
	}
	if parseMaxOutputTokens > geminiDocMaxOutputTokens {
		log.Printf("gemini: GEMINI_PARSE_MAX_OUTPUT=%d exceeds documented limit (%d); API will still cap at model max",
			parseMaxOutputTokens, geminiDocMaxOutputTokens)
	}
	return &Client{genai: c, model: model, parseMaxOutputTokens: parseMaxOutputTokens}, nil
}

type ParsedExercise struct {
	Title     string           `json:"title"`
	Passage   string           `json:"passage"`
	Questions []ParsedQuestion `json:"questions"`
}

type ParsedQuestion struct {
	Type      string   `json:"type"`
	Prompt    string   `json:"prompt"`
	Options   []string `json:"options"`
	Correct   string   `json:"correct"`
	FocusWord string   `json:"focus_word"`
}

type ImagePart struct {
	Data []byte
	MIME string
}

type LearningSummary struct {
	KeyPoints  []string       `json:"key_points"`
	Vocabulary []VocabSummary `json:"vocabulary"`
}

type VocabSummary struct {
	Word     string   `json:"word"`
	Reading  string   `json:"reading"`
	Meaning  string   `json:"meaning"`
	Examples []string `json:"examples"`
}

// ---------------------------------------------------------------------------
// Public API — parse
// ---------------------------------------------------------------------------

func (c *Client) ParseExerciseImage(ctx context.Context, imageBytes []byte, mime string) (*ParsedExercise, error) {
	if mime == "" {
		mime = "image/jpeg"
	}
	return c.parseExercisePipeline(ctx, []ImagePart{{Data: imageBytes, MIME: mime}})
}

func (c *Client) ParseExercisePages(ctx context.Context, pages []ImagePart) (*ParsedExercise, error) {
	if len(pages) == 0 {
		return nil, errors.New("画像がありません")
	}
	return c.parseExercisePipeline(ctx, pages)
}

// ---------------------------------------------------------------------------
// 3-step pipeline
// ---------------------------------------------------------------------------

func (c *Client) parseExercisePipeline(ctx context.Context, pages []ImagePart) (*ParsedExercise, error) {
	log.Printf("parse pipeline_begin pages=%d model=%s", len(pages), c.model)

	// Step 1: OCR — one call per page, plain text only
	raw, err := c.parseStep1OCR(ctx, pages)
	if err != nil {
		return nil, fmt.Errorf("step1_ocr: %w", err)
	}

	// Step 2: structure — plain JSON (no ruby)
	plain, err := c.parseStep2Structure(ctx, raw)
	if err != nil {
		return nil, fmt.Errorf("step2_structure: %w", err)
	}

	// Step 3: ruby — add <ruby> to the plain JSON
	out, err := c.parseStep3Ruby(ctx, plain)
	if err != nil {
		return nil, fmt.Errorf("step3_ruby: %w", err)
	}

	log.Printf("parse pipeline_done title=%q passage_chars=%d questions=%d",
		truncate(out.Title, 60), len(out.Passage), len(out.Questions))
	return out, nil
}

// ---------------------------------------------------------------------------
// Step 1 — OCR
// ---------------------------------------------------------------------------

func (c *Client) parseStep1OCR(ctx context.Context, pages []ImagePart) (string, error) {
	n := len(pages)
	sections := make([]string, 0, n)
	for i, p := range pages {
		mime := p.MIME
		if mime == "" {
			mime = "image/jpeg"
		}
		var user string
		if n == 1 {
			user = step1OCRSingleUser
		} else {
			user = fmt.Sprintf(step1OCRPageUser, i+1, n)
		}
		prompt := step1OCRSystem + "\n\n" + user
		parts := []*genai.Part{
			{Text: prompt},
			{InlineData: &genai.Blob{Data: p.Data, MIMEType: mime}},
		}

		op := fmt.Sprintf("step1_ocr_page_%d", i+1)
		log.Printf("parse %s request prompt_chars=%d image_bytes=%d mime=%s", op, len(prompt), len(p.Data), mime)

		text, err := c.generate(ctx, op, parts, c.ocrConfig())
		if err != nil {
			return "", fmt.Errorf("page %d/%d: %w", i+1, n, err)
		}
		text = stripMarkdownFence(text)
		log.Printf("parse %s response chars=%d preview=%q", op, len(text), logPreview(text))

		if n > 1 {
			sections = append(sections, fmt.Sprintf("--- ページ %d/%d ---\n%s", i+1, n, text))
		} else {
			sections = append(sections, text)
		}
	}
	combined := strings.Join(sections, "\n\n")
	log.Printf("parse step1_ocr combined_chars=%d", len(combined))
	return combined, nil
}

// ---------------------------------------------------------------------------
// Step 2 — structure
// ---------------------------------------------------------------------------

func (c *Client) parseStep2Structure(ctx context.Context, rawText string) (*ParsedExercise, error) {
	user := fmt.Sprintf(step2StructureUser, rawText)
	prompt := step2StructureSystem + "\n\n" + user
	parts := []*genai.Part{{Text: prompt}}

	log.Printf("parse step2_structure request prompt_chars=%d raw_chars=%d", len(prompt), len(rawText))

	text, err := c.generate(ctx, "step2_structure", parts, c.structureConfig())
	if err != nil {
		return nil, err
	}
	log.Printf("parse step2_structure response chars=%d preview=%q", len(text), logPreview(text))

	var out ParsedExercise
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("step2 JSON: %w\nraw: %s", err, truncate(text, 500))
	}
	log.Printf("parse step2_structure parsed title=%q passage_chars=%d questions=%d",
		truncate(out.Title, 60), len(out.Passage), len(out.Questions))
	return &out, nil
}

// ---------------------------------------------------------------------------
// Step 3 — ruby
// ---------------------------------------------------------------------------

func (c *Client) parseStep3Ruby(ctx context.Context, plain *ParsedExercise) (*ParsedExercise, error) {
	inJSON, err := json.Marshal(plain)
	if err != nil {
		return nil, err
	}
	user := fmt.Sprintf(step3RubyUser, string(inJSON))
	prompt := step3RubySystem + "\n\n" + user
	parts := []*genai.Part{{Text: prompt}}

	log.Printf("parse step3_ruby request prompt_chars=%d json_input_chars=%d", len(prompt), len(inJSON))

	text, err := c.generate(ctx, "step3_ruby", parts, c.rubyConfig())
	if err != nil {
		return nil, err
	}
	log.Printf("parse step3_ruby response chars=%d preview=%q", len(text), logPreview(text))

	var out ParsedExercise
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("step3 JSON: %w\nraw: %s", err, truncate(text, 500))
	}
	return &out, nil
}

// ---------------------------------------------------------------------------
// Public API — transcribe / summarize
// ---------------------------------------------------------------------------

const transcribePrompt = `この音声は日本の小学生が国語の問題に答えている声です。
聞き取れた日本語のテキストだけを1行で出力してください。
説明・挨拶・記号は付けないでください。`

func (c *Client) TranscribeAnswerAudio(ctx context.Context, audio []byte, mime string) (string, error) {
	if len(audio) == 0 {
		return "", errors.New("音声データが空です")
	}
	if mime == "" || mime == "application/octet-stream" {
		mime = "audio/mp4"
	}
	parts := []*genai.Part{
		{Text: transcribePrompt},
		{InlineData: &genai.Blob{Data: audio, MIMEType: mime}},
	}
	cfg := &genai.GenerateContentConfig{
		Temperature:     ptrFloat32(0.1),
		MaxOutputTokens: 512,
	}
	return c.generate(ctx, "transcribe_audio", parts, cfg)
}

func (c *Client) SummarizeLearning(ctx context.Context, title, passage, questionsJSON string, scorePercent int) (*LearningSummary, error) {
	user := fmt.Sprintf(summaryUserTemplate,
		strings.TrimSpace(title),
		strings.TrimSpace(passage),
		strings.TrimSpace(questionsJSON),
		scorePercent,
	)
	parts := []*genai.Part{{Text: summarySystemJP + "\n\n" + user}}
	cfg := &genai.GenerateContentConfig{
		Temperature:      ptrFloat32(0.4),
		MaxOutputTokens:  8192,
		ResponseMIMEType: "application/json",
		ResponseSchema:   schemaLearningSummary(),
	}
	text, err := c.generate(ctx, "summarize_learning", parts, cfg)
	if err != nil {
		return nil, err
	}
	var out LearningSummary
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("summary JSON: %w", err)
	}
	return &out, nil
}

// ---------------------------------------------------------------------------
// Core: single GenerateContent call with logging
// ---------------------------------------------------------------------------

func (c *Client) generate(ctx context.Context, op string, parts []*genai.Part, cfg *genai.GenerateContentConfig) (string, error) {
	resp, err := c.genai.Models.GenerateContent(ctx, c.model, []*genai.Content{{Parts: parts}}, cfg)
	if err != nil {
		log.Printf("gemini_error op=%s err=%v", op, err)
		return "", err
	}
	c.logUsage(op, resp)
	text, err := extractText(resp)
	if err != nil {
		log.Printf("gemini_error op=%s extract_err=%v", op, err)
		return "", err
	}
	return text, nil
}

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

func (c *Client) logUsage(op string, resp *genai.GenerateContentResponse) {
	if resp == nil {
		log.Printf("gemini_usage op=%s usage=nil", op)
		return
	}
	mv := resp.ModelVersion
	if mv == "" {
		mv = c.model
	}
	if resp.UsageMetadata == nil {
		log.Printf("gemini_usage op=%s model=%s version=%s usage=missing", op, c.model, mv)
		return
	}
	u := resp.UsageMetadata
	log.Printf("gemini_usage op=%s model=%s version=%s prompt=%d candidates=%d total=%d cached=%d thoughts=%d",
		op, c.model, mv,
		u.PromptTokenCount, u.CandidatesTokenCount, u.TotalTokenCount,
		u.CachedContentTokenCount, u.ThoughtsTokenCount)
}

// ---------------------------------------------------------------------------
// Config builders
// ---------------------------------------------------------------------------

func (c *Client) ocrConfig() *genai.GenerateContentConfig {
	z := int32(0)
	return &genai.GenerateContentConfig{
		Temperature:     ptrFloat32(0.1),
		MaxOutputTokens: c.parseMaxOutputTokens,
		MediaResolution: genai.MediaResolutionHigh,
		ThinkingConfig:  &genai.ThinkingConfig{ThinkingBudget: &z},
	}
}

func (c *Client) structureConfig() *genai.GenerateContentConfig {
	z := int32(0)
	return &genai.GenerateContentConfig{
		Temperature:      ptrFloat32(0.2),
		MaxOutputTokens:  c.parseMaxOutputTokens,
		ResponseMIMEType: "application/json",
		ResponseSchema:   schemaParsedExercisePlain(),
		ThinkingConfig:   &genai.ThinkingConfig{ThinkingBudget: &z},
	}
}

func (c *Client) rubyConfig() *genai.GenerateContentConfig {
	z := int32(0)
	return &genai.GenerateContentConfig{
		Temperature:      ptrFloat32(0.2),
		MaxOutputTokens:  c.parseMaxOutputTokens,
		ResponseMIMEType: "application/json",
		ResponseSchema:   schemaParsedExercise(),
		ThinkingConfig:   &genai.ThinkingConfig{ThinkingBudget: &z},
	}
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

func schemaParsedExercisePlain() *genai.Schema {
	maxQ := int64(12)
	maxPassage := int64(1200)
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"title": {Type: genai.TypeString, Description: "題名（プレーン）"},
			"passage": {
				Type:        genai.TypeString,
				Description: "本文要約プレーンテキスト（約1200文字以内）",
				MaxLength:   &maxPassage,
			},
			"questions": {
				Type:     genai.TypeArray,
				Items:    schemaQuestionItem("問題文（プレーン日本語、HTML禁止）"),
				MaxItems: &maxQ,
			},
		},
		Required: []string{"title", "passage", "questions"},
	}
}

func schemaParsedExercise() *genai.Schema {
	maxQ := int64(12)
	maxPassage := int64(1200)
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"title": {Type: genai.TypeString, Description: "教材の題名"},
			"passage": {
				Type:        genai.TypeString,
				Description: "読解本文（ruby 付きHTML可。約1200文字以内の要約）",
				MaxLength:   &maxPassage,
			},
			"questions": {
				Type:     genai.TypeArray,
				Items:    schemaQuestionItem("問題文（短く）"),
				MaxItems: &maxQ,
			},
		},
		Required: []string{"title", "passage", "questions"},
	}
}

func schemaQuestionItem(promptDesc string) *genai.Schema {
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"type":       {Type: genai.TypeString, Description: "choice または voice"},
			"prompt":     {Type: genai.TypeString, Description: promptDesc},
			"options":    {Type: genai.TypeArray, Items: &genai.Schema{Type: genai.TypeString}},
			"correct":    {Type: genai.TypeString},
			"focus_word": {Type: genai.TypeString},
		},
		Required: []string{"type", "prompt", "options", "correct", "focus_word"},
	}
}

func schemaLearningSummary() *genai.Schema {
	maxKeys := int64(12)
	maxV := int64(12)
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"key_points": {
				Type:     genai.TypeArray,
				Items:    &genai.Schema{Type: genai.TypeString},
				MaxItems: &maxKeys,
			},
			"vocabulary": {
				Type: genai.TypeArray,
				Items: &genai.Schema{
					Type: genai.TypeObject,
					Properties: map[string]*genai.Schema{
						"word":     {Type: genai.TypeString},
						"reading":  {Type: genai.TypeString},
						"meaning":  {Type: genai.TypeString},
						"examples": {Type: genai.TypeArray, Items: &genai.Schema{Type: genai.TypeString}},
					},
					Required: []string{"word", "reading", "meaning", "examples"},
				},
				MaxItems: &maxV,
			},
		},
		Required: []string{"key_points", "vocabulary"},
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func stripMarkdownFence(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s
	}
	s = strings.TrimPrefix(s, "```")
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		head := strings.TrimSpace(s[:i])
		if head != "" && head[0] != '{' {
			s = s[i+1:]
		}
	}
	if last := strings.LastIndex(s, "```"); last >= 0 {
		s = s[:last]
	}
	return strings.TrimSpace(s)
}

func logPreview(s string) string {
	max := logPreviewMax()
	if len(s) <= max {
		return s
	}
	return s[:max] + fmt.Sprintf("…(%d chars total)", len(s))
}

func logPreviewMax() int {
	if v := os.Getenv("KOKUGO_PARSE_LOG_MAX"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return 2000
}

func ptrFloat32(f float32) *float32 { return &f }

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
