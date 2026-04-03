package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds server and integration settings.
type Config struct {
	ListenAddr           string
	DBPath               string
	UploadsDir           string
	LLMProvider          string // gemini (default) | ollama — worksheet image parsing
	ChatBackendSummary   string // gemini | ollama — summary + transcribe (OpenAI-shaped chat)
	ChatBackendJudge     string // gemini | ollama — answer judging
	RubyBackend          string // gemini | ollama — three_step step 3 (furigana JSON)
	GoogleKey            string
	GeminiModel          string
	GeminiJudgeModel     string
	OllamaBaseURL        string
	OllamaModel          string
	OllamaChatModel      string // text/JSON model for chat when using Ollama backend
	ParseStrategy        string // three_step | one_shot
	ChildName            string
	ParseMaxOutputTokens int
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}
	db := os.Getenv("KOKUGO_DB")
	if db == "" {
		db = "./data/kokugo.db"
	}
	up := os.Getenv("KOKUGO_UPLOADS")
	if up == "" {
		up = "./data/uploads"
	}
	child := os.Getenv("CHILD_NAME")
	if child == "" {
		child = "がくせい"
	}
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.5-flash"
	}
	judgeModel := os.Getenv("GEMINI_JUDGE_MODEL")
	if judgeModel == "" {
		judgeModel = "gemini-2.5-flash-lite"
	}
	parseMaxOut := EnvInt("GEMINI_PARSE_MAX_OUTPUT", 65536)
	if parseMaxOut < 1024 {
		parseMaxOut = 65536
	}
	provider := strings.ToLower(strings.TrimSpace(os.Getenv("KOKUGO_LLM_PROVIDER")))
	if provider == "" {
		provider = "gemini"
	}
	parseStrategy := strings.ToLower(strings.TrimSpace(os.Getenv("KOKUGO_PARSE_STRATEGY")))
	if parseStrategy == "" {
		parseStrategy = "three_step"
	}
	ollamaURL := strings.TrimSpace(os.Getenv("OLLAMA_BASE_URL"))
	if ollamaURL == "" {
		ollamaURL = "http://127.0.0.1:11434"
	}
	ollamaModel := strings.TrimSpace(os.Getenv("OLLAMA_MODEL"))
	ollamaChat := strings.TrimSpace(os.Getenv("OLLAMA_CHAT_MODEL"))
	legacyChat := os.Getenv("KOKUGO_CHAT_BACKEND")
	sum := chatBackendRole(os.Getenv("KOKUGO_CHAT_BACKEND_SUMMARY"), legacyChat)
	judge := chatBackendRole(os.Getenv("KOKUGO_CHAT_BACKEND_JUDGE"), legacyChat)
	ruby := chatBackendRole(os.Getenv("KOKUGO_RUBY_BACKEND"), legacyChat)
	return Config{
		ListenAddr:           ":" + port,
		DBPath:               db,
		UploadsDir:           up,
		LLMProvider:          provider,
		ChatBackendSummary:   sum,
		ChatBackendJudge:     judge,
		RubyBackend:          ruby,
		GoogleKey:            os.Getenv("GOOGLE_API_KEY"),
		GeminiModel:          model,
		GeminiJudgeModel:     judgeModel,
		OllamaBaseURL:        ollamaURL,
		OllamaModel:          ollamaModel,
		OllamaChatModel:      ollamaChat,
		ParseStrategy:        parseStrategy,
		ChildName:            child,
		ParseMaxOutputTokens: parseMaxOut,
	}
}

func EnvInt(key string, def int) int {
	s := os.Getenv(key)
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

// chatBackendRole resolves gemini|ollama from envSpecific, then envLegacy (KOKUGO_CHAT_BACKEND), else gemini.
func chatBackendRole(envSpecific, envLegacy string) string {
	if v := normalizeChatBackendEnv(envSpecific); v != "" {
		return v
	}
	if v := normalizeChatBackendEnv(envLegacy); v != "" {
		return v
	}
	return "gemini"
}

func normalizeChatBackendEnv(s string) string {
	v := strings.ToLower(strings.TrimSpace(s))
	if v == "" || v == "auto" {
		return ""
	}
	if v != "gemini" && v != "ollama" {
		return ""
	}
	return v
}
