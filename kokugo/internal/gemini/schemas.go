package gemini

import "google.golang.org/genai"

// schemaParsedPageBundle wraps one or more exercises from a single worksheet page (週課・複数大問).
// Note: Gemini GenerateContent response_schema rejects some JSON Schema array constraints (e.g. minItems);
// keep this schema minimal or the API returns INVALID_ARGUMENT.
func schemaParsedPageBundle() *genai.Schema {
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"exercises": {
				Type:        genai.TypeArray,
				Items:       schemaParsedExercise(),
				Description: "このページに含まれる国語の大問・課題ごとのブロック（順序はプリントの上から）。1件以上。本文だけの続きページなど、設問が写っていないブロックは questions を空配列にしてよい。",
			},
		},
		Required: []string{"exercises"},
	}
}

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
				Type:        genai.TypeArray,
				Items:       schemaQuestionItem("問題文（プレーン日本語、HTML禁止）"),
				MaxItems:    &maxQ,
				Description: "このページの画像に写っている設問のみ。写っていなければ空配列。",
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
				Type:        genai.TypeArray,
				Items:       schemaQuestionItem("問題文（短く）"),
				MaxItems:    &maxQ,
				Description: "このページの画像に写っている設問のみ。写っていなければ空配列（別ページの問を推測して入れない）。",
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

func schemaAnswerJudgment(maxResults *int64) *genai.Schema {
	if maxResults == nil || *maxResults <= 0 {
		v := int64(16)
		maxResults = &v
	}
	maxFeedback := int64(480)
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"results": {
				Type: genai.TypeArray,
				Items: &genai.Schema{
					Type: genai.TypeObject,
					Properties: map[string]*genai.Schema{
						"question_id": {Type: genai.TypeString, Description: "設問の id（入力と同じ）"},
						"is_correct":  {Type: genai.TypeBoolean, Description: "正解なら true"},
						"feedback": {
							Type:        genai.TypeString,
							Description: "子ども向けの短いコメント（正解ならほめる、不正解なら何が違うかとヒント）。漢字はruby付き",
							MaxLength:   &maxFeedback,
						},
					},
					Required: []string{"question_id", "is_correct", "feedback"},
				},
				MaxItems: maxResults,
			},
		},
		Required: []string{"results"},
	}
}

func schemaPrintKeywordCard() *genai.Schema {
	maxPhrase := int64(80)
	maxNuance := int64(320)
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"phrase": {
				Type:        genai.TypeString,
				Description: "フラッシュカードのおもて：ことば・熟語だけを短く。説明や理由は書かない。漢字はruby付き可。",
				MaxLength:   &maxPhrase,
			},
			"nuance": {
				Type:        genai.TypeString,
				Description: "フラッシュカードのうら：そのことばがプリントで大事な理由や意味を子ども向けに1〜2文。漢字はruby付き可。",
				MaxLength:   &maxNuance,
			},
		},
		Required: []string{"phrase", "nuance"},
	}
}

// schemaPrintLearningSummary: whole-print summary; keyword_cards length capped in app (max 10).
func schemaPrintLearningSummary() *genai.Schema {
	maxCards := int64(10)
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"overview": {
				Type:        genai.TypeString,
				Description: "このプリント全体（すべてのだい）を子ども向けに短くまとめた段落。漢字にはrubyを付ける。",
			},
			"keyword_cards": {
				Type:        genai.TypeArray,
				Items:       schemaPrintKeywordCard(),
				MaxItems:    &maxCards,
				Description: "おもて=短い語句、うら=その説明。最大10枚。phrase に長い説明を書かない。",
			},
		},
		Required: []string{"overview", "keyword_cards"},
	}
}
