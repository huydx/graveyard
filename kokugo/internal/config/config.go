package config

import (
	"os"
	"strconv"
)

// Config holds server and integration settings.
type Config struct {
	ListenAddr           string
	DBPath               string
	UploadsDir           string
	GoogleKey            string
	GeminiModel          string
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
	parseMaxOut := EnvInt("GEMINI_PARSE_MAX_OUTPUT", 65536)
	if parseMaxOut < 1024 {
		parseMaxOut = 65536
	}
	return Config{
		ListenAddr:           ":" + port,
		DBPath:               db,
		UploadsDir:           up,
		GoogleKey:            os.Getenv("GOOGLE_API_KEY"),
		GeminiModel:          model,
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
