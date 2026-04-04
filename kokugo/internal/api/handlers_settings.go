package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/huydx/kokugo/internal/config"
	"github.com/huydx/kokugo/internal/ollama"
	"github.com/huydx/kokugo/internal/store"
)

// GetSettings returns persisted UI settings (API key is never returned, only whether one is stored).
func (s *Server) GetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.err(w, http.StatusMethodNotAllowed, "GET のみ")
		return
	}
	db, err := s.Store.GetAppSettings(r.Context())
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	_, effParse, effGoogleKey := MergeAppLLM(s.Cfg, db)
	effOcr := EffectiveOcrServerURL(s.Cfg, db)
	effSum := MergeSummaryBackend(s.Cfg, db)
	effJudge := MergeJudgeBackend(s.Cfg, db)
	effRuby := MergeRubyBackend(s.Cfg, db)
	effOllamaVision := EffectiveOllamaVisionModel(s.Cfg, db)
	effOllamaChat := EffectiveOllamaChatModel(s.Cfg, db)

	stored := func(raw string) string {
		v := strings.TrimSpace(raw)
		if strings.EqualFold(v, "auto") {
			return ""
		}
		return v
	}

	envOllamaChat := strings.TrimSpace(s.Cfg.OllamaChatModel)
	if envOllamaChat == "" {
		envOllamaChat = strings.TrimSpace(s.Cfg.OllamaModel)
	}

	out := map[string]any{
		"ollamaBaseUrl":   db.OllamaBaseURL,
		"ollamaModel":     db.OllamaModel,
		"ollamaChatModel": db.OllamaChatModel,
		"parseStrategy":   db.ParseStrategy,
		"ocrServerUrl":    db.OcrServerURL,

		"summaryChatBackend": stored(db.SummaryChatBackend),
		"judgeChatBackend":   stored(db.JudgeChatBackend),
		"rubyBackend":        stored(db.RubyBackend),
		"chatBackend":        stored(db.ChatBackend),

		"hasGeminiKey":       strings.TrimSpace(db.GoogleAPIKey) != "",
		"geminiKeyEffective": strings.TrimSpace(effGoogleKey) != "",

		"parseStrategyEffective":      effParse,
		"ocrServerUrlEffective":       effOcr,
		"envOcrServerUrl":             strings.TrimSpace(s.Cfg.OcrServerURL),
		"defaultOcrServerUrl":         config.DefaultOcrServerURL,
		"summaryChatBackendEffective": effSum,
		"judgeChatBackendEffective":   effJudge,
		"rubyBackendEffective":        effRuby,
		"chatBackendEffective":        effSum,

		"envOllamaBaseUrl":         strings.TrimSpace(s.Cfg.OllamaBaseURL),
		"envOllamaModel":           strings.TrimSpace(s.Cfg.OllamaModel),
		"envOllamaChatModel":       envOllamaChat,
		"ollamaModelEffective":     effOllamaVision,
		"ollamaChatModelEffective": effOllamaChat,
		"envParseStrategy":         strings.TrimSpace(s.Cfg.ParseStrategy),
		"envSummaryChatBackend": strings.TrimSpace(
			firstNonEmpty(os.Getenv("KOKUGO_CHAT_BACKEND_SUMMARY"), os.Getenv("KOKUGO_CHAT_BACKEND")),
		),
		"envJudgeChatBackend": strings.TrimSpace(
			firstNonEmpty(os.Getenv("KOKUGO_CHAT_BACKEND_JUDGE"), os.Getenv("KOKUGO_CHAT_BACKEND")),
		),
		"envRubyBackend": strings.TrimSpace(
			firstNonEmpty(os.Getenv("KOKUGO_RUBY_BACKEND"), os.Getenv("KOKUGO_CHAT_BACKEND")),
		),
	}
	if !db.UpdatedAt.IsZero() {
		out["updatedAt"] = db.UpdatedAt.Format(time.RFC3339)
	}
	s.json(w, http.StatusOK, out)
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

type putSettingsBody struct {
	OllamaBaseURL   *string `json:"ollamaBaseUrl"`
	OllamaModel     *string `json:"ollamaModel"`
	OllamaChatModel *string `json:"ollamaChatModel"`
	ParseStrategy   *string `json:"parseStrategy"`
	OcrServerURL    *string `json:"ocrServerUrl"`

	SummaryChatBackend *string `json:"summaryChatBackend"`
	JudgeChatBackend   *string `json:"judgeChatBackend"`
	RubyBackend        *string `json:"rubyBackend"`
	ChatBackend        *string `json:"chatBackend"`

	GoogleAPIKey      *string `json:"googleApiKey"`
	ClearGoogleAPIKey *bool   `json:"clearGoogleApiKey"`
}

func validateChatBackendField(v string) (string, bool) {
	cb := strings.ToLower(strings.TrimSpace(v))
	if cb == "" {
		return "", true
	}
	if cb == "auto" {
		return "", false
	}
	if cb != "gemini" && cb != "ollama" {
		return "", false
	}
	return cb, true
}

// PutSettings updates persisted settings and reloads LLM clients.
func (s *Server) PutSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "PUT または POST")
		return
	}
	var body putSettingsBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが不正です")
		return
	}
	if body.ParseStrategy != nil {
		ps := strings.ToLower(strings.TrimSpace(*body.ParseStrategy))
		if ps != "" && ps != "three_step" && ps != "three_step_remote_ocr" && ps != "one_shot" {
			s.err(w, http.StatusBadRequest, "parseStrategy は three_step（2段階）/ three_step_remote_ocr / one_shot")
			return
		}
	}

	var patch store.AppSettingsPatch
	if body.OllamaBaseURL != nil {
		patch.OllamaBaseURL = body.OllamaBaseURL
	}
	if body.OllamaModel != nil {
		patch.OllamaModel = body.OllamaModel
	}
	if body.OllamaChatModel != nil {
		patch.OllamaChatModel = body.OllamaChatModel
	}
	if body.ParseStrategy != nil {
		patch.ParseStrategy = body.ParseStrategy
	}
	if body.OcrServerURL != nil {
		patch.OcrServerURL = body.OcrServerURL
	}

	legacyOnly := body.ChatBackend != nil &&
		body.SummaryChatBackend == nil && body.JudgeChatBackend == nil && body.RubyBackend == nil
	if legacyOnly {
		cb, ok := validateChatBackendField(*body.ChatBackend)
		if !ok {
			s.err(w, http.StatusBadRequest, "chatBackend は gemini か ollama（auto は不可）")
			return
		}
		p := strPtr(cb)
		patch.SummaryChatBackend = p
		patch.JudgeChatBackend = p
		patch.RubyBackend = p
		patch.ChatBackend = p
	} else {
		if body.ChatBackend != nil {
			cb, ok := validateChatBackendField(*body.ChatBackend)
			if !ok {
				s.err(w, http.StatusBadRequest, "chatBackend は gemini か ollama（auto は不可）")
				return
			}
			patch.ChatBackend = strPtr(cb)
		}
		if body.SummaryChatBackend != nil {
			cb, ok := validateChatBackendField(*body.SummaryChatBackend)
			if !ok {
				s.err(w, http.StatusBadRequest, "summaryChatBackend は gemini か ollama")
				return
			}
			patch.SummaryChatBackend = strPtr(cb)
		}
		if body.JudgeChatBackend != nil {
			cb, ok := validateChatBackendField(*body.JudgeChatBackend)
			if !ok {
				s.err(w, http.StatusBadRequest, "judgeChatBackend は gemini か ollama")
				return
			}
			patch.JudgeChatBackend = strPtr(cb)
		}
		if body.RubyBackend != nil {
			cb, ok := validateChatBackendField(*body.RubyBackend)
			if !ok {
				s.err(w, http.StatusBadRequest, "rubyBackend は gemini か ollama")
				return
			}
			patch.RubyBackend = strPtr(cb)
		}
	}

	clearKey := body.ClearGoogleAPIKey != nil && *body.ClearGoogleAPIKey
	patch.ClearGoogleKey = clearKey
	if !clearKey && body.GoogleAPIKey != nil {
		patch.GoogleAPIKey = body.GoogleAPIKey
	}

	if err := s.Store.PatchAppSettings(r.Context(), patch); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.ReloadLLM(r.Context()); err != nil {
		log.Printf("settings: ReloadLLM: %v", err)
		s.err(w, http.StatusInternalServerError, "設定の反映に失敗しました")
		return
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true})
}

func strPtr(s string) *string { return &s }

// GetOllamaCheck probes Ollama GET /api/tags. Query baseUrl overrides merged settings when non-empty.
func (s *Server) GetOllamaCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.err(w, http.StatusMethodNotAllowed, "GET のみ")
		return
	}
	base := strings.TrimSpace(r.URL.Query().Get("baseUrl"))
	if base == "" {
		db, err := s.Store.GetAppSettings(r.Context())
		if err != nil {
			s.err(w, http.StatusInternalServerError, err.Error())
			return
		}
		base, _, _ = MergeAppLLM(s.Cfg, db)
	}
	models, err := ollama.ListLocalModelNames(r.Context(), base)
	if err != nil {
		s.json(w, http.StatusOK, map[string]any{"ok": false, "message": err.Error(), "baseUrl": base})
		return
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true, "models": models, "baseUrl": base})
}
