package gemini

import (
	"strings"

	"google.golang.org/genai"
)

func isGemini3Model(model string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(model)), "gemini-3")
}

// thinkingConfigLowEffort is used when we previously sent thinkingBudget=0 (minimize reasoning / latency).
// Gemini 3 expects thinkingLevel; thinkingBudget there can cause API errors or odd behavior.
func thinkingConfigLowEffort(model string) *genai.ThinkingConfig {
	if isGemini3Model(model) {
		return &genai.ThinkingConfig{ThinkingLevel: genai.ThinkingLevelMinimal}
	}
	z := int32(0)
	return &genai.ThinkingConfig{ThinkingBudget: &z}
}

// thinkingConfigForParse maps pipeline ThinkingBudget to a valid ThinkingConfig per model family.
func thinkingConfigForParse(model string, budget *int32) *genai.ThinkingConfig {
	if budget == nil {
		return nil
	}
	if *budget == 0 {
		return thinkingConfigLowEffort(model)
	}
	if isGemini3Model(model) {
		// Prefer level over budget on Gemini 3; keep latency reasonable.
		return &genai.ThinkingConfig{ThinkingLevel: genai.ThinkingLevelLow}
	}
	return &genai.ThinkingConfig{ThinkingBudget: budget}
}
