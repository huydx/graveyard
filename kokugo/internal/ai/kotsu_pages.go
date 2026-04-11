package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

type kotsuPagesEnvelope struct {
	Pages []MathExerciseKotsuSummary `json:"pages"`
}

// MarshalKotsuPagesJSON stores summaries as {"pages":[...]}.
func MarshalKotsuPagesJSON(pages []MathExerciseKotsuSummary) (string, error) {
	b, err := json.Marshal(kotsuPagesEnvelope{Pages: pages})
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// ParseKotsuPagesFromStorageJSON reads new envelope or legacy single-object JSON.
func ParseKotsuPagesFromStorageJSON(j string) ([]MathExerciseKotsuSummary, error) {
	j = strings.TrimSpace(j)
	if j == "" {
		return nil, fmt.Errorf("empty summary")
	}
	var withPages struct {
		Pages json.RawMessage `json:"pages"`
	}
	if err := json.Unmarshal([]byte(j), &withPages); err == nil && withPages.Pages != nil {
		var pages []MathExerciseKotsuSummary
		if err := json.Unmarshal(withPages.Pages, &pages); err != nil {
			return nil, fmt.Errorf("kotsu pages: %w", err)
		}
		return pages, nil
	}
	var single MathExerciseKotsuSummary
	if err := json.Unmarshal([]byte(j), &single); err == nil && strings.TrimSpace(single.MainIdea) != "" {
		return []MathExerciseKotsuSummary{single}, nil
	}
	return nil, fmt.Errorf("kotsu summary: unknown JSON shape")
}
