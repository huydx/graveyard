package api

import (
	"context"
	"log"
	"strings"

	"github.com/huydx/kokugo/internal/ai"
	"github.com/huydx/kokugo/internal/config"
	"github.com/huydx/kokugo/internal/gemini"
	"github.com/huydx/kokugo/internal/ollama"
	"github.com/huydx/kokugo/internal/store"
)

// llmRuntime holds clients rebuilt from DB app_settings + the tenant user's Gemini key only (no env API key).
type llmRuntime struct {
	imageParser ai.ExerciseImageParser

	summaryChat  ai.ChatCompleter
	summaryModel string
	judgeChat    ai.ChatCompleter
	judgeModel   string
	transcribeOK bool

	effOllamaURL      string
	effSummaryBackend string
	effJudgeBackend   string
}

// MergeOllamaURL resolves Ollama base URL from DB then config (Gemini key is per-user, not here).
func MergeOllamaURL(cfg config.Config, db store.AppSettings) string {
	ollamaURL := strings.TrimSpace(db.OllamaBaseURL)
	if ollamaURL == "" {
		ollamaURL = strings.TrimSpace(cfg.OllamaBaseURL)
	}
	return ollamaURL
}

// EffectiveOllamaChatModel: DB ollama_chat_model → OLLAMA_CHAT_MODEL → OLLAMA_MODEL.
func EffectiveOllamaChatModel(cfg config.Config, db store.AppSettings) string {
	if v := strings.TrimSpace(db.OllamaChatModel); v != "" {
		return v
	}
	if v := strings.TrimSpace(cfg.OllamaChatModel); v != "" {
		return v
	}
	return strings.TrimSpace(cfg.OllamaModel)
}

func normalizeMergedBackend(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	if v == "" || v == "auto" {
		return ""
	}
	if v != "gemini" && v != "ollama" {
		return ""
	}
	return v
}

// MergeSummaryBackend: DB role column → legacy chat_backend → env default.
func MergeSummaryBackend(cfg config.Config, db store.AppSettings) string {
	if v := normalizeMergedBackend(db.SummaryChatBackend); v != "" {
		return v
	}
	if v := normalizeMergedBackend(db.ChatBackend); v != "" {
		return v
	}
	return cfg.ChatBackendSummary
}

// MergeJudgeBackend: DB role column → legacy chat_backend → env default.
func MergeJudgeBackend(cfg config.Config, db store.AppSettings) string {
	if v := normalizeMergedBackend(db.JudgeChatBackend); v != "" {
		return v
	}
	if v := normalizeMergedBackend(db.ChatBackend); v != "" {
		return v
	}
	return cfg.ChatBackendJudge
}

func (s *Server) invalidateLLMUser(userID string) {
	if userID == "" {
		return
	}
	s.llmMu.Lock()
	defer s.llmMu.Unlock()
	if s.llmByUser != nil {
		delete(s.llmByUser, userID)
	}
}

// reloadLLMForUser rebuilds and caches the LLM runtime for one tenant (after login or settings change).
func (s *Server) reloadLLMForUser(ctx context.Context, userID string) error {
	rt, err := s.buildLLMRuntimeForUser(ctx, userID)
	if err != nil {
		return err
	}
	s.llmMu.Lock()
	if s.llmByUser == nil {
		s.llmByUser = make(map[string]*llmRuntime)
	}
	s.llmByUser[userID] = rt
	s.llmMu.Unlock()
	return nil
}

func (s *Server) lmFor(userID string) *llmRuntime {
	if userID == "" {
		return &llmRuntime{}
	}
	s.llmMu.Lock()
	if s.llmByUser == nil {
		s.llmByUser = make(map[string]*llmRuntime)
	}
	if rt, ok := s.llmByUser[userID]; ok && rt != nil {
		s.llmMu.Unlock()
		return rt
	}
	s.llmMu.Unlock()
	if err := s.reloadLLMForUser(context.Background(), userID); err != nil {
		log.Printf("lmFor user=%s: %v", userID, err)
		return &llmRuntime{}
	}
	s.llmMu.Lock()
	defer s.llmMu.Unlock()
	if rt, ok := s.llmByUser[userID]; ok && rt != nil {
		return rt
	}
	return &llmRuntime{}
}

func (s *Server) buildLLMRuntimeForUser(ctx context.Context, userID string) (*llmRuntime, error) {
	db, err := s.Store.GetAppSettings(ctx)
	if err != nil {
		return nil, err
	}
	u, err := s.Store.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	gKey := strings.TrimSpace(u.GoogleAPIKey)
	ollamaURL := MergeOllamaURL(s.Cfg, db)
	maxTok := int32(s.Cfg.ParseMaxOutputTokens)

	var gem *gemini.Client
	if gKey != "" {
		c, err := gemini.New(ctx, gKey, s.Cfg.GeminiModel, maxTok, s.Cfg.GeminiJudgeModel)
		if err != nil {
			log.Printf("llm: gemini client user=%s: %v", userID, err)
		} else {
			gem = c
		}
	}

	var imageParser ai.ExerciseImageParser
	if gem != nil {
		imageParser = ai.NewOneShotParser(gem, maxTok)
	}

	sumB := MergeSummaryBackend(s.Cfg, db)
	judgeB := MergeJudgeBackend(s.Cfg, db)
	effOllamaChat := EffectiveOllamaChatModel(s.Cfg, db)
	summaryChat, summaryModel, transcribeOK := buildSummaryChat(s.Cfg, gem, ollamaURL, sumB, effOllamaChat)
	judgeChat, judgeModel := buildJudgeChat(s.Cfg, gem, ollamaURL, judgeB, effOllamaChat)

	return &llmRuntime{
		imageParser:       imageParser,
		summaryChat:       summaryChat,
		summaryModel:      summaryModel,
		judgeChat:         judgeChat,
		judgeModel:        judgeModel,
		transcribeOK:      transcribeOK,
		effOllamaURL:      ollamaURL,
		effSummaryBackend: sumB,
		effJudgeBackend:   judgeB,
	}, nil
}

func buildSummaryChat(cfg config.Config, gem *gemini.Client, ollamaBaseURL, backend, ollamaChatModel string) (chat ai.ChatCompleter, chatModel string, transcribeOK bool) {
	b := strings.TrimSpace(strings.ToLower(backend))
	if b == "" || b == "auto" {
		b = "gemini"
	}
	ollamaChat := strings.TrimSpace(ollamaChatModel)
	base := strings.TrimSpace(ollamaBaseURL)
	if base == "" {
		base = strings.TrimSpace(cfg.OllamaBaseURL)
	}

	switch b {
	case "ollama":
		if ollamaChat == "" {
			return nil, "", false
		}
		return ollama.NewChatClient(base, ollamaChat), ollamaChat, false
	default:
		if gem == nil {
			return nil, "", false
		}
		return gem, gem.Model(), true
	}
}

func buildJudgeChat(cfg config.Config, gem *gemini.Client, ollamaBaseURL, backend, ollamaChatModel string) (chat ai.ChatCompleter, judgeModel string) {
	b := strings.TrimSpace(strings.ToLower(backend))
	if b == "" || b == "auto" {
		b = "gemini"
	}
	ollamaChat := strings.TrimSpace(ollamaChatModel)
	base := strings.TrimSpace(ollamaBaseURL)
	if base == "" {
		base = strings.TrimSpace(cfg.OllamaBaseURL)
	}

	switch b {
	case "ollama":
		if ollamaChat == "" {
			return nil, ""
		}
		return ollama.NewChatClient(base, ollamaChat), ollamaChat
	default:
		if gem == nil {
			return nil, ""
		}
		return gem, gem.JudgeModel()
	}
}
