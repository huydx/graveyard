package api

import (
	"context"
	"log"
	"strings"

	"github.com/huydx/kokugo/internal/ai"
	"github.com/huydx/kokugo/internal/config"
	"github.com/huydx/kokugo/internal/gemini"
	"github.com/huydx/kokugo/internal/ollama"
	"github.com/huydx/kokugo/internal/paddleocr"
	"github.com/huydx/kokugo/internal/store"
)

// llmRuntime holds clients rebuilt from env + DB app_settings.
type llmRuntime struct {
	imageParser ai.ExerciseImageParser

	summaryChat  ai.ChatCompleter
	summaryModel string
	judgeChat    ai.ChatCompleter
	judgeModel   string
	transcribeOK bool

	effParseStrat     string
	effOllamaURL      string
	effSummaryBackend string
	effJudgeBackend   string
	effRubyBackend    string
	effOcrServerURL   string
}

func (s *Server) lm() *llmRuntime {
	v := s.llm.Load()
	if v == nil {
		return &llmRuntime{}
	}
	return v
}

// MergeAppLLM resolves Ollama URL, parse strategy, and Google API key.
// For the API key: a non-empty value stored in the database wins; if the DB value is empty, GOOGLE_API_KEY from the environment is used.
func MergeAppLLM(cfg config.Config, db store.AppSettings) (ollamaURL, parseStrat, googleKey string) {
	ollamaURL = strings.TrimSpace(db.OllamaBaseURL)
	if ollamaURL == "" {
		ollamaURL = strings.TrimSpace(cfg.OllamaBaseURL)
	}
	parseStrat = strings.TrimSpace(db.ParseStrategy)
	if parseStrat == "" {
		parseStrat = strings.TrimSpace(cfg.ParseStrategy)
	}
	if parseStrat == "" {
		parseStrat = "three_step"
	}
	googleKey = strings.TrimSpace(db.GoogleAPIKey)
	if googleKey == "" {
		googleKey = strings.TrimSpace(cfg.GoogleKey)
	}
	return ollamaURL, parseStrat, googleKey
}

// EffectiveOcrServerURL: DB ocr_server_url → KOKUGO_OCR_SERVER_URL → built-in default.
func EffectiveOcrServerURL(cfg config.Config, db store.AppSettings) string {
	if v := strings.TrimSpace(db.OcrServerURL); v != "" {
		return strings.TrimRight(v, "/")
	}
	if v := strings.TrimSpace(cfg.OcrServerURL); v != "" {
		return strings.TrimRight(v, "/")
	}
	return strings.TrimRight(config.DefaultOcrServerURL, "/")
}

// EffectiveOllamaVisionModel: DB ollama_model → OLLAMA_MODEL env.
func EffectiveOllamaVisionModel(cfg config.Config, db store.AppSettings) string {
	if v := strings.TrimSpace(db.OllamaModel); v != "" {
		return v
	}
	return strings.TrimSpace(cfg.OllamaModel)
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

// MergeRubyBackend: DB role column → legacy chat_backend → env default.
func MergeRubyBackend(cfg config.Config, db store.AppSettings) string {
	if v := normalizeMergedBackend(db.RubyBackend); v != "" {
		return v
	}
	if v := normalizeMergedBackend(db.ChatBackend); v != "" {
		return v
	}
	return cfg.RubyBackend
}

// ReloadLLM rebuilds worksheet parser and chat stack from environment merged with DB settings.
func (s *Server) ReloadLLM(ctx context.Context) error {
	db, err := s.Store.GetAppSettings(ctx)
	if err != nil {
		return err
	}
	ollamaURL, parseStrat, gKey := MergeAppLLM(s.Cfg, db)
	ocrBase := EffectiveOcrServerURL(s.Cfg, db)
	maxTok := int32(s.Cfg.ParseMaxOutputTokens)

	var gem *gemini.Client
	if gKey != "" {
		c, err := gemini.New(ctx, gKey, s.Cfg.GeminiModel, maxTok, s.Cfg.GeminiJudgeModel)
		if err != nil {
			log.Printf("llm: gemini client: %v", err)
		} else {
			gem = c
		}
	}

	visionModel := EffectiveOllamaVisionModel(s.Cfg, db)
	var ollamaEM *ollama.ExerciseModel
	if visionModel != "" {
		ollamaEM = ollama.NewExerciseModel(ollamaURL, visionModel)
	}

	var vision ai.ExerciseParseModel
	switch strings.ToLower(strings.TrimSpace(s.Cfg.LLMProvider)) {
	case "ollama":
		vision = ollamaEM
	default:
		if s.Cfg.LLMProvider != "gemini" {
			// already logged at startup
		}
		vision = gem
	}

	rubyB := MergeRubyBackend(s.Cfg, db)
	rubyModel := exerciseParseModel(rubyB, gem, ollamaEM)
	if rubyModel == nil && vision != nil {
		rubyModel = vision
	}

	var imageParser ai.ExerciseImageParser
	if vision != nil {
		imageParser = newExerciseImageParser(vision, rubyModel, parseStrat, maxTok, ocrBase)
	}

	sumB := MergeSummaryBackend(s.Cfg, db)
	judgeB := MergeJudgeBackend(s.Cfg, db)
	effOllamaChat := EffectiveOllamaChatModel(s.Cfg, db)
	summaryChat, summaryModel, transcribeOK := buildSummaryChat(s.Cfg, gem, ollamaURL, sumB, effOllamaChat)
	judgeChat, judgeModel := buildJudgeChat(s.Cfg, gem, ollamaURL, judgeB, effOllamaChat)

	rt := &llmRuntime{
		imageParser:       imageParser,
		summaryChat:       summaryChat,
		summaryModel:      summaryModel,
		judgeChat:         judgeChat,
		judgeModel:        judgeModel,
		transcribeOK:      transcribeOK,
		effParseStrat:     parseStrat,
		effOllamaURL:      ollamaURL,
		effSummaryBackend: sumB,
		effJudgeBackend:   judgeB,
		effRubyBackend:    rubyB,
		effOcrServerURL:   ocrBase,
	}
	s.llm.Store(rt)
	return nil
}

func exerciseParseModel(backend string, gem *gemini.Client, ollamaEM *ollama.ExerciseModel) ai.ExerciseParseModel {
	b := strings.TrimSpace(strings.ToLower(backend))
	if b == "" || b == "auto" {
		b = "gemini"
	}
	switch b {
	case "ollama":
		if ollamaEM == nil {
			return nil
		}
		return ollamaEM
	default:
		if gem == nil {
			return nil
		}
		return gem
	}
}

func newExerciseImageParser(vision, ruby ai.ExerciseParseModel, strategy string, maxTok int32, ocrBaseURL string) ai.ExerciseImageParser {
	switch strings.ToLower(strings.TrimSpace(strategy)) {
	case "one_shot":
		return ai.NewOneShotParser(vision, maxTok)
	case "three_step_remote_ocr":
		ocr := paddleocr.NewClient(ocrBaseURL, nil)
		return ai.NewTwoStepParser(vision, ruby, maxTok, ocr)
	default:
		return ai.NewTwoStepParser(vision, ruby, maxTok, nil)
	}
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
