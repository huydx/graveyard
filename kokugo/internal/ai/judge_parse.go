package ai

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
)

type judgeParsedRow struct {
	QuestionID string
	IsCorrect  bool
	Feedback   string
}

// sliceOuterJSON returns the substring from the first "{" to the last "}" (helps when the model adds prose around JSON).
func sliceOuterJSON(text string) string {
	start := strings.IndexByte(text, '{')
	end := strings.LastIndexByte(text, '}')
	if start >= 0 && end > start {
		return text[start : end+1]
	}
	return text
}

// parseJudgeResultsJSON parses the judge assistant output.
// Gemini follows {"results":[...]}; Ollama models often use other key names or camelCase.
func parseJudgeResultsJSON(text string) ([]judgeParsedRow, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("empty judge JSON")
	}

	out, err := parseJudgeResultsJSONCore(text)
	if err == nil && len(out) > 0 {
		return out, nil
	}
	inner := strings.TrimSpace(sliceOuterJSON(text))
	if inner != "" && inner != text {
		out2, err2 := parseJudgeResultsJSONCore(inner)
		if err2 == nil && len(out2) > 0 {
			log.Printf("judge_answers: json_recovered_from_wrapped_text rows=%d", len(out2))
			return out2, nil
		}
	}
	if err != nil && len(out) == 0 {
		return out, err
	}
	if len(out) > 0 {
		return out, nil
	}
	if err != nil {
		return nil, err
	}
	return nil, fmt.Errorf("results missing or empty")
}

func parseJudgeResultsJSONCore(text string) ([]judgeParsedRow, error) {
	type strictRow struct {
		QuestionID string `json:"question_id"`
		IsCorrect  bool   `json:"is_correct"`
		Feedback   string `json:"feedback"`
	}
	var strict struct {
		Results []strictRow `json:"results"`
	}
	errStrict := json.Unmarshal([]byte(text), &strict)
	if errStrict == nil && len(strict.Results) > 0 {
		out := make([]judgeParsedRow, 0, len(strict.Results))
		for _, r := range strict.Results {
			out = append(out, judgeParsedRow{
				QuestionID: strings.TrimSpace(r.QuestionID),
				IsCorrect:  r.IsCorrect,
				Feedback:   r.Feedback,
			})
		}
		return out, nil
	}

	flex := tryFlexibleJudgeRows(text)
	if len(flex) > 0 {
		log.Printf("judge_answers: flexible_json_parse rows=%d (model used non-standard JSON keys or shape)", len(flex))
		return flex, nil
	}
	if errStrict != nil {
		return nil, errStrict
	}
	return nil, fmt.Errorf("results missing or empty")
}

func tryFlexibleJudgeRows(text string) []judgeParsedRow {
	var root map[string]json.RawMessage
	if err := json.Unmarshal([]byte(text), &root); err == nil {
		priority := []string{"results", "result", "judgments", "answers", "items", "scores", "data", "output", "grading", "evaluations"}
		var best []judgeParsedRow
		for _, key := range priority {
			if raw, ok := root[key]; ok {
				if rows := parseJudgeJSONArrayRaw(raw); len(rows) > len(best) {
					best = rows
				}
			}
		}
		if len(best) == 0 {
			for _, raw := range root {
				if rows := parseJudgeJSONArrayRaw(raw); len(rows) > len(best) {
					best = rows
				}
			}
		}
		if len(best) > 0 {
			return best
		}
	}

	var flat map[string]any
	if err := json.Unmarshal([]byte(text), &flat); err == nil {
		if row, ok := mapToJudgeRow(flat); ok {
			return []judgeParsedRow{row}
		}
	}

	var arr []map[string]any
	if err := json.Unmarshal([]byte(text), &arr); err == nil {
		return mapsToJudgeRows(arr)
	}
	return nil
}

func parseJudgeJSONArrayRaw(raw json.RawMessage) []judgeParsedRow {
	var objs []map[string]any
	if err := json.Unmarshal(raw, &objs); err != nil {
		return nil
	}
	return mapsToJudgeRows(objs)
}

func mapsToJudgeRows(objs []map[string]any) []judgeParsedRow {
	out := make([]judgeParsedRow, 0, len(objs))
	for _, m := range objs {
		if row, ok := mapToJudgeRow(m); ok {
			out = append(out, row)
		}
	}
	return out
}

func mapToJudgeRow(m map[string]any) (judgeParsedRow, bool) {
	id := judgeStringField(m, "question_id", "questionId", "q_id", "id", "questionID")
	if id == "" {
		return judgeParsedRow{}, false
	}
	return judgeParsedRow{
		QuestionID: strings.TrimSpace(id),
		IsCorrect:  judgeBoolField(m, "is_correct", "isCorrect", "correct", "right", "ok"),
		Feedback:   judgeStringField(m, "feedback", "comment", "message", "explanation", "hint", "reason"),
	}, true
}

func judgeStringField(m map[string]any, keys ...string) string {
	for _, k := range keys {
		v, ok := m[k]
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case string:
			if s := strings.TrimSpace(t); s != "" {
				return s
			}
		case float64:
			return strconv.FormatInt(int64(t), 10)
		case bool:
			return strconv.FormatBool(t)
		default:
			s := strings.TrimSpace(fmt.Sprint(t))
			if s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}

func judgeBoolField(m map[string]any, keys ...string) bool {
	for _, k := range keys {
		v, ok := m[k]
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case bool:
			return t
		case string:
			s := strings.TrimSpace(strings.ToLower(t))
			return s == "true" || s == "1" || s == "yes"
		case float64:
			return t != 0
		}
	}
	return false
}
