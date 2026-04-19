package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/huydx/kokugo/internal/ollama"
	"github.com/huydx/kokugo/internal/store"
)

// GetSettings returns persisted UI settings (API key is never returned, only whether one is stored).
func (s *Server) GetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.err(w, http.StatusMethodNotAllowed, "GET のみ")
		return
	}
	uid := UserIDFromCtx(r.Context())
	u, err := s.Store.GetUserByID(r.Context(), uid)
	if err != nil {
		s.err(w, http.StatusUnauthorized, "ログインが必要です")
		return
	}
	db, err := s.Store.GetAppSettings(r.Context())
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	effGoogleKey := strings.TrimSpace(u.GoogleAPIKey)
	effSum := MergeSummaryBackend(s.Cfg, db)
	effJudge := MergeJudgeBackend(s.Cfg, db)
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
		"ollamaChatModel": db.OllamaChatModel,

		"summaryChatBackend": stored(db.SummaryChatBackend),
		"judgeChatBackend":   stored(db.JudgeChatBackend),
		"chatBackend":        stored(db.ChatBackend),

		"hasGeminiKey":       effGoogleKey != "",
		"geminiKeyEffective": effGoogleKey != "",
		"digestTopic":        strings.TrimSpace(u.DigestTopic),

		"summaryChatBackendEffective": effSum,
		"judgeChatBackendEffective":   effJudge,
		"chatBackendEffective":        effSum,

		"envOllamaBaseUrl":         strings.TrimSpace(s.Cfg.OllamaBaseURL),
		"envOllamaChatModel":       envOllamaChat,
		"ollamaChatModelEffective": effOllamaChat,
		"envSummaryChatBackend": strings.TrimSpace(
			firstNonEmpty(os.Getenv("KOKUGO_CHAT_BACKEND_SUMMARY"), os.Getenv("KOKUGO_CHAT_BACKEND")),
		),
		"envJudgeChatBackend": strings.TrimSpace(
			firstNonEmpty(os.Getenv("KOKUGO_CHAT_BACKEND_JUDGE"), os.Getenv("KOKUGO_CHAT_BACKEND")),
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
	OllamaChatModel *string `json:"ollamaChatModel"`

	SummaryChatBackend *string `json:"summaryChatBackend"`
	JudgeChatBackend   *string `json:"judgeChatBackend"`
	ChatBackend        *string `json:"chatBackend"`

	GoogleAPIKey      *string `json:"googleApiKey"`
	ClearGoogleAPIKey *bool   `json:"clearGoogleApiKey"`
	DigestTopic       *string `json:"digestTopic"`
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

// PutSettings updates persisted settings and reloads LLM clients for the current user.
func (s *Server) PutSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "PUT または POST")
		return
	}
	uid := UserIDFromCtx(r.Context())
	var body putSettingsBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが不正です")
		return
	}

	var patch store.AppSettingsPatch
	if body.OllamaBaseURL != nil {
		patch.OllamaBaseURL = body.OllamaBaseURL
	}
	if body.OllamaChatModel != nil {
		patch.OllamaChatModel = body.OllamaChatModel
	}

	legacyOnly := body.ChatBackend != nil && body.SummaryChatBackend == nil && body.JudgeChatBackend == nil
	if legacyOnly {
		cb, ok := validateChatBackendField(*body.ChatBackend)
		if !ok {
			s.err(w, http.StatusBadRequest, "chatBackend は gemini か ollama（auto は不可）")
			return
		}
		p := strPtr(cb)
		patch.SummaryChatBackend = p
		patch.JudgeChatBackend = p
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
	}

	if err := s.Store.PatchAppSettings(r.Context(), patch); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}

	userPatch := store.UserGeminiDigestPatch{}
	if body.ClearGoogleAPIKey != nil && *body.ClearGoogleAPIKey {
		userPatch.ClearGoogleAPIKey = true
	} else if body.GoogleAPIKey != nil {
		userPatch.GoogleAPIKey = body.GoogleAPIKey
	}
	if body.DigestTopic != nil {
		userPatch.DigestTopic = body.DigestTopic
	}
	if userPatch.GoogleAPIKey != nil || userPatch.ClearGoogleAPIKey || userPatch.DigestTopic != nil {
		if err := s.Store.PatchUserGeminiAndDigest(r.Context(), uid, userPatch); err != nil {
			s.err(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	s.invalidateLLMUser(uid)
	if err := s.reloadLLMForUser(r.Context(), uid); err != nil {
		log.Printf("settings: reload LLM user=%s: %v", uid, err)
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
		base = MergeOllamaURL(s.Cfg, db)
	}
	models, err := ollama.ListLocalModelNames(r.Context(), base)
	if err != nil {
		s.json(w, http.StatusOK, map[string]any{"ok": false, "message": err.Error(), "baseUrl": base})
		return
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true, "models": models, "baseUrl": base})
}
