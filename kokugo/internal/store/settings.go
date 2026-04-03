package store

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

// AppSettings are persisted UI/env overrides (single row, id=1).
type AppSettings struct {
	OllamaBaseURL        string
	ParseStrategy        string
	GoogleAPIKey         string
	ChatBackend          string // legacy single column; used as fallback when role columns empty
	SummaryChatBackend   string
	JudgeChatBackend     string
	RubyBackend          string
	UpdatedAt            time.Time
}

func (s *Store) GetAppSettings(ctx context.Context) (AppSettings, error) {
	var out AppSettings
	var updated sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT ollama_base_url, parse_strategy, google_api_key, chat_backend,
			summary_chat_backend, judge_chat_backend, ruby_backend, updated_at
		FROM app_settings WHERE id = 1`).Scan(
		&out.OllamaBaseURL, &out.ParseStrategy, &out.GoogleAPIKey, &out.ChatBackend,
		&out.SummaryChatBackend, &out.JudgeChatBackend, &out.RubyBackend, &updated)
	if err != nil {
		return out, err
	}
	if updated.Valid && updated.String != "" {
		out.UpdatedAt = parseAppSettingTime(updated.String)
	}
	return out, nil
}

func parseAppSettingTime(s string) time.Time {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	if t, err := time.ParseInLocation("2006-01-02 15:04:05", s, time.UTC); err == nil {
		return t
	}
	return time.Time{}
}

// AppSettingsPatch updates only non-nil string fields. Use ClearGoogleKey to wipe stored API key.
type AppSettingsPatch struct {
	OllamaBaseURL       *string
	ParseStrategy       *string
	SummaryChatBackend *string
	JudgeChatBackend   *string
	RubyBackend        *string
	ChatBackend        *string // legacy: if set alone, API may fan out to the three role columns
	GoogleAPIKey       *string
	ClearGoogleKey     bool
}

// PatchAppSettings merges patch into the single settings row.
func (s *Store) PatchAppSettings(ctx context.Context, patch AppSettingsPatch) error {
	cur, err := s.GetAppSettings(ctx)
	if err != nil {
		return err
	}
	if patch.OllamaBaseURL != nil {
		cur.OllamaBaseURL = strings.TrimSpace(*patch.OllamaBaseURL)
	}
	if patch.ParseStrategy != nil {
		cur.ParseStrategy = strings.TrimSpace(*patch.ParseStrategy)
	}
	if patch.SummaryChatBackend != nil {
		cur.SummaryChatBackend = strings.TrimSpace(*patch.SummaryChatBackend)
	}
	if patch.JudgeChatBackend != nil {
		cur.JudgeChatBackend = strings.TrimSpace(*patch.JudgeChatBackend)
	}
	if patch.RubyBackend != nil {
		cur.RubyBackend = strings.TrimSpace(*patch.RubyBackend)
	}
	if patch.ChatBackend != nil {
		cur.ChatBackend = strings.TrimSpace(*patch.ChatBackend)
	}
	if patch.ClearGoogleKey {
		cur.GoogleAPIKey = ""
	} else if patch.GoogleAPIKey != nil {
		cur.GoogleAPIKey = strings.TrimSpace(*patch.GoogleAPIKey)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = s.db.ExecContext(ctx, `
		UPDATE app_settings SET
			ollama_base_url = ?, parse_strategy = ?, google_api_key = ?,
			chat_backend = ?, summary_chat_backend = ?, judge_chat_backend = ?, ruby_backend = ?,
			updated_at = ?
		WHERE id = 1`,
		cur.OllamaBaseURL, cur.ParseStrategy, cur.GoogleAPIKey,
		cur.ChatBackend, cur.SummaryChatBackend, cur.JudgeChatBackend, cur.RubyBackend,
		now)
	return err
}
