package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func Open(dbPath string) (*Store, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", dbPath+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS exercises (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL DEFAULT '',
			passage TEXT NOT NULL DEFAULT '',
			image_path TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'draft',
			created_at TEXT NOT NULL,
			completed_at TEXT,
			answers_json TEXT NOT NULL DEFAULT '{}',
			score_percent INTEGER NOT NULL DEFAULT 0
		);`,
		`CREATE TABLE IF NOT EXISTS questions (
			id TEXT PRIMARY KEY,
			exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
			sort_order INTEGER NOT NULL,
			q_type TEXT NOT NULL,
			prompt TEXT NOT NULL,
			options_json TEXT NOT NULL DEFAULT '[]',
			correct_answer TEXT NOT NULL DEFAULT '',
			focus_word TEXT NOT NULL DEFAULT ''
		);`,
		`CREATE INDEX IF NOT EXISTS idx_questions_ex ON questions(exercise_id);`,
		`CREATE TABLE IF NOT EXISTS exercise_summaries (
			exercise_id TEXT PRIMARY KEY REFERENCES exercises(id) ON DELETE CASCADE,
			summary_json TEXT NOT NULL,
			created_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS vocab_cards (
			id TEXT PRIMARY KEY,
			word TEXT NOT NULL,
			reading TEXT NOT NULL DEFAULT '',
			meaning TEXT NOT NULL DEFAULT '',
			examples_json TEXT NOT NULL DEFAULT '[]',
			source_exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
			created_at TEXT NOT NULL,
			last_reviewed TEXT,
			review_count INTEGER NOT NULL DEFAULT 0
		);`,
		`CREATE INDEX IF NOT EXISTS idx_vocab_source ON vocab_cards(source_exercise_id);`,
		`CREATE INDEX IF NOT EXISTS idx_vocab_created ON vocab_cards(created_at);`,
		`CREATE TABLE IF NOT EXISTS exercise_pages (
			exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
			sort_order INTEGER NOT NULL,
			image_path TEXT NOT NULL,
			PRIMARY KEY (exercise_id, sort_order)
		);`,
		`CREATE INDEX IF NOT EXISTS idx_exercise_pages_ex ON exercise_pages(exercise_id);`,
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	if _, err := s.db.Exec(`
		INSERT OR IGNORE INTO exercise_pages (exercise_id, sort_order, image_path)
		SELECT id, 0, image_path FROM exercises
		WHERE image_path != '' AND NOT EXISTS (
			SELECT 1 FROM exercise_pages ep WHERE ep.exercise_id = exercises.id
		)`); err != nil {
		return fmt.Errorf("migrate backfill exercise_pages: %w", err)
	}
	return nil
}

// --- Exercises ---

type Exercise struct {
	ID           string     `json:"id"`
	Title        string     `json:"title"`
	Passage      string     `json:"passage"`
	ImagePath    string     `json:"imagePath"`
	ImagePaths   []string   `json:"imagePaths,omitempty"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"createdAt"`
	CompletedAt  *time.Time `json:"completedAt,omitempty"`
	AnswersJSON  string     `json:"answersJson,omitempty"`
	ScorePercent int        `json:"scorePercent"`
}

type Question struct {
	ID            string   `json:"id"`
	ExerciseID    string   `json:"exerciseId"`
	SortOrder     int      `json:"sortOrder"`
	Type          string   `json:"type"`
	Prompt        string   `json:"prompt"`
	Options       []string `json:"options"`
	CorrectAnswer string   `json:"correctAnswer"`
	FocusWord     string   `json:"focusWord"`
}

func (s *Store) CreateExerciseDraft(ctx context.Context, imagePath string) (*Exercise, error) {
	id := uuid.NewString()
	now := time.Now().UTC()
	ts := now.Format(time.RFC3339)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO exercises (id, title, passage, image_path, status, created_at)
		VALUES (?, '', '', ?, 'draft', ?)`, id, imagePath, ts); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO exercise_pages (exercise_id, sort_order, image_path) VALUES (?, 0, ?)`, id, imagePath); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &Exercise{
		ID: id, ImagePath: imagePath, ImagePaths: []string{imagePath}, Status: "draft", CreatedAt: now,
	}, nil
}

func (s *Store) AddExercisePage(ctx context.Context, exerciseID, imagePath string) error {
	var max sql.NullInt64
	err := s.db.QueryRowContext(ctx, `
		SELECT MAX(sort_order) FROM exercise_pages WHERE exercise_id = ?`, exerciseID).Scan(&max)
	if err != nil {
		return err
	}
	next := int64(0)
	if max.Valid {
		next = max.Int64 + 1
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO exercise_pages (exercise_id, sort_order, image_path) VALUES (?, ?, ?)`,
		exerciseID, next, imagePath)
	return err
}

func (s *Store) ListExercisePagePaths(ctx context.Context, exerciseID string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT image_path FROM exercise_pages WHERE exercise_id = ? ORDER BY sort_order`, exerciseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var paths []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, rows.Err()
}

func (s *Store) attachImagePaths(ctx context.Context, ex *Exercise) error {
	paths, err := s.ListExercisePagePaths(ctx, ex.ID)
	if err != nil {
		return err
	}
	if len(paths) == 0 && ex.ImagePath != "" {
		paths = []string{ex.ImagePath}
	}
	ex.ImagePaths = paths
	if len(paths) > 0 {
		ex.ImagePath = paths[0]
	}
	return nil
}

func (s *Store) SetExerciseParsed(ctx context.Context, id, title, passage string) error {
	res, err := s.db.ExecContext(ctx, `
		UPDATE exercises SET title = ?, passage = ?, status = 'parsed' WHERE id = ?`, title, passage, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) ReplaceQuestions(ctx context.Context, exerciseID string, qs []Question) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `DELETE FROM questions WHERE exercise_id = ?`, exerciseID); err != nil {
		return err
	}
	for i := range qs {
		q := qs[i]
		if q.ID == "" {
			q.ID = uuid.NewString()
		}
		opts, _ := json.Marshal(q.Options)
		_, err := tx.ExecContext(ctx, `
			INSERT INTO questions (id, exercise_id, sort_order, q_type, prompt, options_json, correct_answer, focus_word)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			q.ID, exerciseID, i, q.Type, q.Prompt, string(opts), q.CorrectAnswer, q.FocusWord)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) GetExercise(ctx context.Context, id string) (*Exercise, []Question, error) {
	var ex Exercise
	var created, completed sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT id, title, passage, image_path, status, created_at, completed_at, answers_json, score_percent
		FROM exercises WHERE id = ?`, id).Scan(
		&ex.ID, &ex.Title, &ex.Passage, &ex.ImagePath, &ex.Status, &created, &completed, &ex.AnswersJSON, &ex.ScorePercent)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, nil, err
	}
	ex.CreatedAt, _ = time.Parse(time.RFC3339, created.String)
	if completed.Valid && completed.String != "" {
		t, _ := time.Parse(time.RFC3339, completed.String)
		ex.CompletedAt = &t
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, exercise_id, sort_order, q_type, prompt, options_json, correct_answer, focus_word
		FROM questions WHERE exercise_id = ? ORDER BY sort_order`, id)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var list []Question
	for rows.Next() {
		var q Question
		var opts string
		if err := rows.Scan(&q.ID, &q.ExerciseID, &q.SortOrder, &q.Type, &q.Prompt, &opts, &q.CorrectAnswer, &q.FocusWord); err != nil {
			return nil, nil, err
		}
		_ = json.Unmarshal([]byte(opts), &q.Options)
		list = append(list, q)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	if err := s.attachImagePaths(ctx, &ex); err != nil {
		return nil, nil, err
	}
	return &ex, list, nil
}

func (s *Store) SaveAnswersAndComplete(ctx context.Context, exerciseID string, answers map[string]string, scorePercent int) error {
	b, err := json.Marshal(answers)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.ExecContext(ctx, `
		UPDATE exercises SET answers_json = ?, score_percent = ?, status = 'completed', completed_at = ?
		WHERE id = ?`, string(b), scorePercent, now, exerciseID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) ListExercises(ctx context.Context, limit int) ([]Exercise, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, title, passage, image_path, status, created_at, completed_at, score_percent
		FROM exercises ORDER BY created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Exercise
	for rows.Next() {
		var ex Exercise
		var created, completed sql.NullString
		if err := rows.Scan(&ex.ID, &ex.Title, &ex.Passage, &ex.ImagePath, &ex.Status, &created, &completed, &ex.ScorePercent); err != nil {
			return nil, err
		}
		ex.CreatedAt, _ = time.Parse(time.RFC3339, created.String)
		if completed.Valid && completed.String != "" {
			t, _ := time.Parse(time.RFC3339, completed.String)
			ex.CompletedAt = &t
		}
		out = append(out, ex)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if err := s.attachImagePaths(ctx, &out[i]); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// --- Summary & vocab ---

func (s *Store) SaveSummary(ctx context.Context, exerciseID, summaryJSON string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO exercise_summaries (exercise_id, summary_json, created_at)
		VALUES (?, ?, ?)
		ON CONFLICT(exercise_id) DO UPDATE SET summary_json = excluded.summary_json, created_at = excluded.created_at`,
		exerciseID, summaryJSON, now)
	return err
}

func (s *Store) GetSummary(ctx context.Context, exerciseID string) (string, error) {
	var j string
	err := s.db.QueryRowContext(ctx, `SELECT summary_json FROM exercise_summaries WHERE exercise_id = ?`, exerciseID).Scan(&j)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return j, err
}

type VocabCard struct {
	ID               string     `json:"id"`
	Word             string     `json:"word"`
	Reading          string     `json:"reading"`
	Meaning          string     `json:"meaning"`
	Examples         []string   `json:"examples"`
	SourceExerciseID string     `json:"sourceExerciseId"`
	CreatedAt        time.Time  `json:"createdAt"`
	LastReviewed     *time.Time `json:"lastReviewed,omitempty"`
	ReviewCount      int        `json:"reviewCount"`
}

type VocabItem struct {
	Word     string
	Reading  string
	Meaning  string
	Examples []string
}

func (s *Store) InsertVocabCards(ctx context.Context, exerciseID string, items []VocabItem) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `DELETE FROM vocab_cards WHERE source_exercise_id = ?`, exerciseID); err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, it := range items {
		ex, _ := json.Marshal(it.Examples)
		id := uuid.NewString()
		_, err := tx.ExecContext(ctx, `
			INSERT INTO vocab_cards (id, word, reading, meaning, examples_json, source_exercise_id, created_at, review_count)
			VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
			id, it.Word, it.Reading, it.Meaning, string(ex), exerciseID, now)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) MonthlyVocab(ctx context.Context, days int) ([]VocabCard, error) {
	if days <= 0 {
		days = 35
	}
	since := time.Now().UTC().AddDate(0, 0, -days).Format(time.RFC3339)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, word, reading, meaning, examples_json, source_exercise_id, created_at, last_reviewed, review_count
		FROM vocab_cards WHERE created_at >= ? ORDER BY created_at DESC`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanVocabRows(rows)
}

func (s *Store) AllVocabForReview(ctx context.Context, limit int) ([]VocabCard, error) {
	if limit <= 0 {
		limit = 200
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, word, reading, meaning, examples_json, source_exercise_id, created_at, last_reviewed, review_count
		FROM vocab_cards ORDER BY datetime(created_at) DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanVocabRows(rows)
}

func scanVocabRows(rows *sql.Rows) ([]VocabCard, error) {
	var out []VocabCard
	for rows.Next() {
		var c VocabCard
		var ex, created, lr sql.NullString
		if err := rows.Scan(&c.ID, &c.Word, &c.Reading, &c.Meaning, &ex, &c.SourceExerciseID, &created, &lr, &c.ReviewCount); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(ex.String), &c.Examples)
		c.CreatedAt, _ = time.Parse(time.RFC3339, created.String)
		if lr.Valid && lr.String != "" {
			t, _ := time.Parse(time.RFC3339, lr.String)
			c.LastReviewed = &t
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) TouchVocabReview(ctx context.Context, cardID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		UPDATE vocab_cards SET last_reviewed = ?, review_count = review_count + 1 WHERE id = ?`, now, cardID)
	return err
}
