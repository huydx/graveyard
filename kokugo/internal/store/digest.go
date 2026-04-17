package store

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	WeeklyDigestStatusStocked   = "stocked"
	WeeklyDigestStatusCompleted = "completed"
)

type WeeklyDigest struct {
	ID          string     `json:"id"`
	Topic       string     `json:"topic"`
	SubTopic    string     `json:"subTopic"`
	Content     string     `json:"content"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

func (s *Store) ListWeeklyDigestsByTopic(ctx context.Context, topic, status string, limit int) ([]WeeklyDigest, error) {
	if limit <= 0 {
		limit = 20
	}
	topic = strings.TrimSpace(topic)
	status = strings.TrimSpace(status)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, topic, sub_topic, content, status, created_at, completed_at
		FROM weekly_digests
		WHERE topic = ? AND status = ?
		ORDER BY datetime(created_at) ASC
		LIMIT ?`, topic, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []WeeklyDigest
	for rows.Next() {
		var d WeeklyDigest
		var created, completed sql.NullString
		if err := rows.Scan(&d.ID, &d.Topic, &d.SubTopic, &d.Content, &d.Status, &created, &completed); err != nil {
			return nil, err
		}
		d.CreatedAt, _ = time.Parse(time.RFC3339, created.String)
		if completed.Valid && completed.String != "" {
			t, _ := time.Parse(time.RFC3339, completed.String)
			d.CompletedAt = &t
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) CountWeeklyDigestsByTopic(ctx context.Context, topic, status string) (int, error) {
	topic = strings.TrimSpace(topic)
	status = strings.TrimSpace(status)
	var n int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM weekly_digests WHERE topic = ? AND status = ?`, topic, status).Scan(&n)
	return n, err
}

func (s *Store) InsertWeeklyDigest(ctx context.Context, topic, subTopic, content string) (*WeeklyDigest, error) {
	topic = strings.TrimSpace(topic)
	subTopic = strings.TrimSpace(subTopic)
	content = strings.TrimSpace(content)
	now := time.Now().UTC()
	id := uuid.NewString()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO weekly_digests (id, topic, sub_topic, content, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		id, topic, subTopic, content, WeeklyDigestStatusStocked, now.Format(time.RFC3339))
	if err != nil {
		return nil, err
	}
	return &WeeklyDigest{
		ID:        id,
		Topic:     topic,
		SubTopic:  subTopic,
		Content:   content,
		Status:    WeeklyDigestStatusStocked,
		CreatedAt: now,
	}, nil
}

func (s *Store) CompleteWeeklyDigest(ctx context.Context, id string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.ExecContext(ctx, `
		UPDATE weekly_digests
		SET status = ?, completed_at = ?
		WHERE id = ? AND status = ?`,
		WeeklyDigestStatusCompleted, now, id, WeeklyDigestStatusStocked)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) ListWeeklyDigestSubTopics(ctx context.Context, topic string, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 100
	}
	topic = strings.TrimSpace(topic)
	rows, err := s.db.QueryContext(ctx, `
		SELECT sub_topic FROM weekly_digests
		WHERE topic = ?
		ORDER BY datetime(created_at) DESC
		LIMIT ?`, topic, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var sub string
		if err := rows.Scan(&sub); err != nil {
			return nil, err
		}
		out = append(out, strings.TrimSpace(sub))
	}
	return out, rows.Err()
}
