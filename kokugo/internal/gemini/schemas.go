package gemini

import "google.golang.org/genai"

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
