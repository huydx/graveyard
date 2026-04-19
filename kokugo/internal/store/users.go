package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	adminSeedEmail  = "admin@admin.com"
	admin1SeedEmail = "admin1@admin.com"
	seedPassword    = "123123"
)

// User is a tenant account (one user = one tenant).
type User struct {
	ID             string
	Email          string
	GoogleAPIKey   string
	DigestTopic    string
	CreatedAt      time.Time
	PasswordHash   string `json:"-"`
}

func hashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// GetUserByEmail loads a user for login.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u User
	var created string
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, ifnull(google_api_key,''), ifnull(digest_topic,''), created_at
		FROM users WHERE lower(email) = ?`, email).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.GoogleAPIKey, &u.DigestTopic, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt, _ = time.Parse(time.RFC3339, created)
	return &u, nil
}

// GetUserByID returns user row including API key (for LLM wiring).
func (s *Store) GetUserByID(ctx context.Context, id string) (*User, error) {
	var u User
	var created string
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, ifnull(google_api_key,''), ifnull(digest_topic,''), created_at
		FROM users WHERE id = ?`, id).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.GoogleAPIKey, &u.DigestTopic, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt, _ = time.Parse(time.RFC3339, created)
	return &u, nil
}

// PatchUserGeminiAndDigest updates the current user's Gemini key and/or digest topic.
type UserGeminiDigestPatch struct {
	GoogleAPIKey      *string
	ClearGoogleAPIKey bool
	DigestTopic       *string
}

func (s *Store) PatchUserGeminiAndDigest(ctx context.Context, userID string, p UserGeminiDigestPatch) error {
	u, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if p.ClearGoogleAPIKey {
		u.GoogleAPIKey = ""
	} else if p.GoogleAPIKey != nil {
		u.GoogleAPIKey = strings.TrimSpace(*p.GoogleAPIKey)
	}
	if p.DigestTopic != nil {
		u.DigestTopic = strings.TrimSpace(*p.DigestTopic)
	}
	_, err = s.db.ExecContext(ctx, `
		UPDATE users SET google_api_key = ?, digest_topic = ? WHERE id = ?`,
		u.GoogleAPIKey, u.DigestTopic, userID)
	return err
}

func randomSessionToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

const sessionTTL = 30 * 24 * time.Hour

// CreateSession stores a new session and returns the opaque token.
func (s *Store) CreateSession(ctx context.Context, userID string) (token string, err error) {
	tok, err := randomSessionToken()
	if err != nil {
		return "", err
	}
	exp := time.Now().UTC().Add(sessionTTL).Format(time.RFC3339)
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`, tok, userID, exp)
	if err != nil {
		return "", err
	}
	return tok, nil
}

// SessionUserID returns the user id for a valid non-expired session token.
func (s *Store) SessionUserID(ctx context.Context, token string) (string, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return "", sql.ErrNoRows
	}
	var uid string
	var expStr string
	err := s.db.QueryRowContext(ctx, `
		SELECT user_id, expires_at FROM sessions WHERE token = ?`, token).Scan(&uid, &expStr)
	if errors.Is(err, sql.ErrNoRows) {
		return "", sql.ErrNoRows
	}
	if err != nil {
		return "", err
	}
	exp, _ := time.Parse(time.RFC3339, expStr)
	if time.Now().UTC().After(exp) {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token = ?`, token)
		return "", sql.ErrNoRows
	}
	return uid, nil
}

// DeleteSession removes one session (logout).
func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token = ?`, strings.TrimSpace(token))
	return err
}

// ensureSeedUsers creates bootstrap admins if the users table is empty.
func (s *Store) ensureSeedUsers(ctx context.Context) error {
	var n int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, row := range []struct {
		email string
	}{
		{adminSeedEmail},
		{admin1SeedEmail},
	} {
		h, err := hashPassword(seedPassword)
		if err != nil {
			return err
		}
		id := uuid.NewString()
		if _, err := s.db.ExecContext(ctx, `
			INSERT INTO users (id, email, password_hash, google_api_key, digest_topic, created_at)
			VALUES (?, ?, ?, '', '', ?)`, id, row.email, h, now); err != nil {
			return fmt.Errorf("seed user %s: %w", row.email, err)
		}
	}
	return nil
}

func (s *Store) adminUserID(ctx context.Context) (string, error) {
	var id string
	err := s.db.QueryRowContext(ctx, `SELECT id FROM users WHERE lower(email) = ?`, adminSeedEmail).Scan(&id)
	return id, err
}

// migrateUsersAndTenancy adds users/sessions, scopes assignments and digests, seeds admins, migrates legacy API key.
func (s *Store) migrateUsersAndTenancy() error {
	ctx := context.Background()
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			google_api_key TEXT NOT NULL DEFAULT '',
			digest_topic TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`,
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("migrate users/tenancy: %w", err)
		}
	}
	if _, err := s.db.Exec(`ALTER TABLE assignments ADD COLUMN user_id TEXT REFERENCES users(id)`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate assignments user_id: %w", err)
		}
	}
	if _, err := s.db.Exec(`ALTER TABLE weekly_digests ADD COLUMN user_id TEXT REFERENCES users(id)`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate weekly_digests user_id: %w", err)
		}
	}
	if err := s.ensureSeedUsers(ctx); err != nil {
		return err
	}
	adminID, err := s.adminUserID(ctx)
	if err != nil {
		return fmt.Errorf("admin user: %w", err)
	}
	if _, err := s.db.ExecContext(ctx, `
		UPDATE assignments SET user_id = ? WHERE user_id IS NULL OR trim(ifnull(user_id,'')) = ''`, adminID); err != nil {
		return fmt.Errorf("backfill assignment user_id: %w", err)
	}
	if _, err := s.db.ExecContext(ctx, `
		UPDATE weekly_digests SET user_id = ? WHERE user_id IS NULL OR trim(ifnull(user_id,'')) = ''`, adminID); err != nil {
		return fmt.Errorf("backfill digest user_id: %w", err)
	}
	var gk, dt string
	_ = s.db.QueryRowContext(ctx, `
		SELECT ifnull(google_api_key,''), ifnull(digest_topic,'') FROM app_settings WHERE id = 1`).Scan(&gk, &dt)
	gk = strings.TrimSpace(gk)
	dt = strings.TrimSpace(dt)
	if gk != "" {
		if _, err := s.db.ExecContext(ctx, `
			UPDATE users SET google_api_key = ? WHERE id = ? AND trim(ifnull(google_api_key,'')) = ''`, gk, adminID); err != nil {
			return err
		}
	}
	if dt != "" {
		if _, err := s.db.ExecContext(ctx, `
			UPDATE users SET digest_topic = ? WHERE id = ? AND trim(ifnull(digest_topic,'')) = ''`, dt, adminID); err != nil {
			return err
		}
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE app_settings SET google_api_key = '', digest_topic = '' WHERE id = 1`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`DROP INDEX IF EXISTS idx_weekly_digests_sub_topic_unique`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_digests_user_sub
		ON weekly_digests(user_id, sub_topic)`); err != nil {
		return fmt.Errorf("digest unique index: %w", err)
	}
	return nil
}
