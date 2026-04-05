package gemini

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/huydx/kokugo/internal/ai"
	"google.golang.org/genai"
)

// geminiRequestLoggingDisabled is true when KOKUGO_GEMINI_LOG_REQUEST is 0, false, or no (case-insensitive).
// When disabled, full request bodies are not logged. Default: log on.
func geminiRequestLoggingDisabled() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("KOKUGO_GEMINI_LOG_REQUEST")))
	return v == "0" || v == "false" || v == "no"
}

func nativeExerciseSchemaLabel(s ai.NativeExerciseSchema) string {
	switch s {
	case ai.NativeExerciseSchemaPlainParsedExercise:
		return "plain_parsed_exercise"
	case ai.NativeExerciseSchemaParsedExerciseWithRuby:
		return "parsed_exercise_with_ruby"
	case ai.NativeExerciseSchemaParsedPageBundleWithRuby:
		return "parsed_page_bundle_with_ruby"
	default:
		return "none"
	}
}

func thinkingBudgetString(budget *int32) string {
	if budget == nil {
		return "nil"
	}
	return fmt.Sprintf("%d", *budget)
}

// logExerciseParseGeminiRequest logs system instruction, config, and each user part (text preview; image = mime + size only).
func logExerciseParseGeminiRequest(op, model, systemInstruction string, genParts []*genai.Part, opts ai.ExerciseParseGenOpts, maxOut int32, cfg *genai.GenerateContentConfig) {
	if geminiRequestLoggingDisabled() {
		return
	}
	hasSchema := cfg != nil && cfg.ResponseSchema != nil
	respMIME := ""
	if cfg != nil {
		respMIME = cfg.ResponseMIMEType
	}
	log.Printf("gemini_parse_request op=%s model=%s parts=%d temperature=%g max_output_tokens=%d vision_high_detail=%v thinking_budget=%s response_mime=%q native_schema=%s json_mode=%v response_schema=%v",
		op, model, len(genParts), opts.Temperature, maxOut, opts.VisionHighDetail, thinkingBudgetString(opts.ThinkingBudget),
		respMIME, nativeExerciseSchemaLabel(opts.NativeSchema), opts.JSONMode, hasSchema)

	if systemInstruction != "" {
		log.Printf("gemini_parse_request_system op=%s chars=%d text=%q", op, len(systemInstruction), ai.LogPreview(systemInstruction))
	} else {
		log.Printf("gemini_parse_request_system op=%s (empty)", op)
	}

	for i, part := range genParts {
		switch {
		case part.Text != "":
			log.Printf("gemini_parse_request_part op=%s idx=%d kind=text chars=%d text=%q", op, i, len(part.Text), ai.LogPreview(part.Text))
		case part.InlineData != nil:
			log.Printf("gemini_parse_request_part op=%s idx=%d kind=inline_data mime=%s bytes=%d", op, i, part.InlineData.MIMEType, len(part.InlineData.Data))
		default:
			log.Printf("gemini_parse_request_part op=%s idx=%d kind=empty", op, i)
		}
	}
}

// logChatGeminiRequest logs merged system instruction, each content turn, and generation config (summary / judge / etc.).
func logChatGeminiRequest(model string, cfg *genai.GenerateContentConfig, contents []*genai.Content, jsonMode bool, structured ai.ChatGeminiStructuredKind) {
	if geminiRequestLoggingDisabled() {
		return
	}
	hasSchema := cfg != nil && cfg.ResponseSchema != nil
	respMIME := ""
	maxOut := int32(0)
	if cfg != nil {
		respMIME = cfg.ResponseMIMEType
		maxOut = cfg.MaxOutputTokens
	}
	temp := float32(0)
	if cfg != nil && cfg.Temperature != nil {
		temp = *cfg.Temperature
	}
	log.Printf("gemini_chat_request model=%s contents=%d temperature=%g max_output_tokens=%d response_mime=%q json_mode=%v gemini_structured=%d response_schema=%v",
		model, len(contents), temp, maxOut, respMIME, jsonMode, int(structured), hasSchema)

	if cfg != nil && cfg.SystemInstruction != nil {
		var sb strings.Builder
		for _, p := range cfg.SystemInstruction.Parts {
			if p != nil && p.Text != "" {
				sb.WriteString(p.Text)
			}
		}
		sys := sb.String()
		if sys != "" {
			log.Printf("gemini_chat_request_system model=%s chars=%d text=%q", model, len(sys), ai.LogPreview(sys))
		}
	}

	for ci, c := range contents {
		if c == nil {
			continue
		}
		role := c.Role
		for pi, p := range c.Parts {
			if p == nil {
				continue
			}
			switch {
			case p.Text != "":
				log.Printf("gemini_chat_request_part model=%s content_idx=%d role=%s part_idx=%d kind=text chars=%d text=%q",
					model, ci, role, pi, len(p.Text), ai.LogPreview(p.Text))
			case p.InlineData != nil:
				log.Printf("gemini_chat_request_part model=%s content_idx=%d role=%s part_idx=%d kind=inline_data mime=%s bytes=%d",
					model, ci, role, pi, p.InlineData.MIMEType, len(p.InlineData.Data))
			default:
				log.Printf("gemini_chat_request_part model=%s content_idx=%d role=%s part_idx=%d kind=empty", model, ci, role, pi)
			}
		}
	}
}
