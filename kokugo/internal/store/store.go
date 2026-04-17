package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/huydx/kokugo/internal/textnorm"
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
		`CREATE TABLE IF NOT EXISTS app_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			ollama_base_url TEXT NOT NULL DEFAULT '',
			parse_strategy TEXT NOT NULL DEFAULT '',
			google_api_key TEXT NOT NULL DEFAULT '',
			chat_backend TEXT NOT NULL DEFAULT '',
			updated_at TEXT NOT NULL DEFAULT ''
		);`,
		`INSERT OR IGNORE INTO app_settings (id, ollama_base_url, parse_strategy, google_api_key, updated_at)
		 VALUES (1, '', '', '', strftime('%Y-%m-%dT%H:%M:%SZ','now'));`,
		`CREATE TABLE IF NOT EXISTS weekly_digests (
			id TEXT PRIMARY KEY,
			topic TEXT NOT NULL,
			sub_topic TEXT NOT NULL,
			content TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'stocked',
			created_at TEXT NOT NULL,
			completed_at TEXT
		);`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_digests_sub_topic_unique ON weekly_digests(sub_topic);`,
		`CREATE INDEX IF NOT EXISTS idx_weekly_digests_topic_status_created
			ON weekly_digests(topic, status, datetime(created_at));`,
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
	if _, err := s.db.Exec(`ALTER TABLE app_settings ADD COLUMN chat_backend TEXT NOT NULL DEFAULT ''`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate app_settings chat_backend: %w", err)
		}
	}
	for _, col := range []string{
		`summary_chat_backend`,
		`judge_chat_backend`,
		`ruby_backend`,
	} {
		q := `ALTER TABLE app_settings ADD COLUMN ` + col + ` TEXT NOT NULL DEFAULT ''`
		if _, err := s.db.Exec(q); err != nil {
			if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
				return fmt.Errorf("migrate app_settings %s: %w", col, err)
			}
		}
	}
	if _, err := s.db.Exec(`
		UPDATE app_settings SET
			summary_chat_backend = CASE WHEN trim(summary_chat_backend) = '' AND trim(chat_backend) != '' THEN chat_backend ELSE summary_chat_backend END,
			judge_chat_backend = CASE WHEN trim(judge_chat_backend) = '' AND trim(chat_backend) != '' THEN chat_backend ELSE judge_chat_backend END,
			ruby_backend = CASE WHEN trim(ruby_backend) = '' AND trim(chat_backend) != '' THEN chat_backend ELSE ruby_backend END
		WHERE id = 1`); err != nil {
		return fmt.Errorf("migrate app_settings backfill role backends: %w", err)
	}
	for _, col := range []string{`ollama_model`, `ollama_chat_model`} {
		q := `ALTER TABLE app_settings ADD COLUMN ` + col + ` TEXT NOT NULL DEFAULT ''`
		if _, err := s.db.Exec(q); err != nil {
			if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
				return fmt.Errorf("migrate app_settings %s: %w", col, err)
			}
		}
	}
	if _, err := s.db.Exec(`ALTER TABLE app_settings ADD COLUMN digest_topic TEXT NOT NULL DEFAULT ''`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate app_settings digest_topic: %w", err)
		}
	}
	if _, err := s.db.Exec(`ALTER TABLE app_settings ADD COLUMN ocr_server_url TEXT NOT NULL DEFAULT ''`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate app_settings ocr_server_url: %w", err)
		}
	}
	if _, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS assignments (
			id TEXT PRIMARY KEY,
			created_at TEXT NOT NULL,
			subject TEXT NOT NULL DEFAULT 'kokugo'
		);`); err != nil {
		return fmt.Errorf("migrate assignments table: %w", err)
	}
	if _, err := s.db.Exec(`ALTER TABLE assignments ADD COLUMN subject TEXT NOT NULL DEFAULT 'kokugo'`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate assignments subject: %w", err)
		}
	}
	if _, err := s.db.Exec(`UPDATE assignments SET subject = 'kokugo' WHERE trim(ifnull(subject, '')) = ''`); err != nil {
		return fmt.Errorf("migrate assignments subject backfill: %w", err)
	}
	if _, err := s.db.Exec(`ALTER TABLE exercises ADD COLUMN assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate exercises assignment_id: %w", err)
		}
	}
	if _, err := s.db.Exec(`ALTER TABLE exercises ADD COLUMN assignment_sort INTEGER NOT NULL DEFAULT 0`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate exercises assignment_sort: %w", err)
		}
	}
	if err := s.backfillAssignments(); err != nil {
		return err
	}
	if _, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS print_summaries (
			assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
			summary_json TEXT NOT NULL,
			created_at TEXT NOT NULL
		);`); err != nil {
		return fmt.Errorf("migrate print_summaries: %w", err)
	}
	if _, err := s.db.Exec(`ALTER TABLE assignments ADD COLUMN title TEXT NOT NULL DEFAULT ''`); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("migrate assignments title: %w", err)
		}
	}
	for _, col := range []struct {
		name string
		typ  string
	}{
		{"speed_read_segments_json", `TEXT NOT NULL DEFAULT ''`},
		{"speed_read_segments_passage", `TEXT NOT NULL DEFAULT ''`},
	} {
		q := `ALTER TABLE exercises ADD COLUMN ` + col.name + ` ` + col.typ
		if _, err := s.db.Exec(q); err != nil {
			if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
				return fmt.Errorf("migrate exercises %s: %w", col.name, err)
			}
		}
	}
	return nil
}

func (s *Store) backfillAssignments() error {
	ctx := context.Background()
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, created_at FROM exercises
		WHERE assignment_id IS NULL OR trim(ifnull(assignment_id, '')) = ''`)
	if err != nil {
		return fmt.Errorf("backfill assignments: %w", err)
	}
	defer rows.Close()
	type pair struct {
		id, created string
	}
	var list []pair
	for rows.Next() {
		var p pair
		if err := rows.Scan(&p.id, &p.created); err != nil {
			return err
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, p := range list {
		aid := uuid.NewString()
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO assignments (id, created_at, subject) VALUES (?, ?, 'kokugo')`, aid, p.created); err != nil {
			_ = tx.Rollback()
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE exercises SET assignment_id = ?, assignment_sort = 0 WHERE id = ?`, aid, p.id); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// --- Exercises ---

type Exercise struct {
	ID                    string     `json:"id"`
	Title                 string     `json:"title"`
	Passage               string     `json:"passage"`
	ImagePath             string     `json:"imagePath"`
	ImagePaths            []string   `json:"imagePaths,omitempty"`
	Status                string     `json:"status"`
	CreatedAt             time.Time  `json:"createdAt"`
	CompletedAt           *time.Time `json:"completedAt,omitempty"`
	AnswersJSON           string     `json:"answersJson,omitempty"`
	ScorePercent          int        `json:"scorePercent"`
	AssignmentID          string     `json:"assignmentId,omitempty"`
	AssignmentSort        int        `json:"assignmentSort"`
	SpeedReadHTMLSegments []string   `json:"speedReadHtmlSegments,omitempty"`
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
	aid := uuid.NewString()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO assignments (id, created_at, subject) VALUES (?, ?, 'kokugo')`, aid, ts); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO exercises (id, title, passage, image_path, status, created_at, assignment_id, assignment_sort)
		VALUES (?, '', '', ?, 'draft', ?, ?, 0)`, id, imagePath, ts, aid); err != nil {
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
		AssignmentID: aid, AssignmentSort: 0,
	}, nil
}

// CreateEmptyPrintDraft creates an assignment and a primary draft exercise with no pages yet (画像はあとから追加).
func (s *Store) CreateEmptyPrintDraft(ctx context.Context) (*Exercise, error) {
	return s.CreateEmptyPrintDraftForSubject(ctx, "kokugo")
}

func normalizeSubject(subject string) string {
	v := strings.ToLower(strings.TrimSpace(subject))
	if v == "sansu" {
		return "sansu"
	}
	return "kokugo"
}

func (s *Store) CreateEmptyPrintDraftForSubject(ctx context.Context, subject string) (*Exercise, error) {
	id := uuid.NewString()
	now := time.Now().UTC()
	ts := now.Format(time.RFC3339)
	subject = normalizeSubject(subject)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	aid := uuid.NewString()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO assignments (id, created_at, subject) VALUES (?, ?, ?)`, aid, ts, subject); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO exercises (id, title, passage, image_path, status, created_at, assignment_id, assignment_sort)
		VALUES (?, '', '', '', 'draft', ?, ?, 0)`, id, ts, aid); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &Exercise{
		ID: id, ImagePath: "", ImagePaths: nil, Status: "draft", CreatedAt: now,
		AssignmentID: aid, AssignmentSort: 0,
	}, nil
}

// AppendDraftExerciseToAssignment adds an empty draft row at the end of a print (assignment).
func (s *Store) AppendDraftExerciseToAssignment(ctx context.Context, assignmentID string) (*Exercise, error) {
	var maxSort sql.NullInt64
	err := s.db.QueryRowContext(ctx, `
		SELECT MAX(assignment_sort) FROM exercises WHERE assignment_id = ?`, assignmentID).Scan(&maxSort)
	if err != nil {
		return nil, err
	}
	nextSort := 0
	if maxSort.Valid {
		nextSort = int(maxSort.Int64) + 1
	}
	id := uuid.NewString()
	now := time.Now().UTC()
	ts := now.Format(time.RFC3339)
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO exercises (id, title, passage, image_path, status, created_at, assignment_id, assignment_sort, answers_json, score_percent)
		VALUES (?, '', '', '', 'draft', ?, ?, ?, '{}', 0)`,
		id, ts, assignmentID, nextSort); err != nil {
		return nil, err
	}
	ex, _, err := s.GetExercise(ctx, id)
	if err != nil {
		return nil, err
	}
	return ex, nil
}

var (
	ErrNotDraft    = errors.New("下書きのときだけページを削除できます")
	ErrInvalidPage = errors.New("ページ番号が不正です")
)

// RemovePageResult is returned after removing a draft exercise page or deleting the whole draft.
type RemovePageResult struct {
	ExerciseDeleted bool
	ImagePaths      []string
	FilesToRemove   []string
}

func (s *Store) RemoveExercisePageAt(ctx context.Context, exerciseID string, pageIndex int) (RemovePageResult, error) {
	var zero RemovePageResult
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return zero, err
	}
	defer func() { _ = tx.Rollback() }()

	var status string
	err = tx.QueryRowContext(ctx, `SELECT status FROM exercises WHERE id = ?`, exerciseID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return zero, sql.ErrNoRows
	}
	if err != nil {
		return zero, err
	}
	if status != "draft" {
		return zero, ErrNotDraft
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT image_path FROM exercise_pages WHERE exercise_id = ? ORDER BY sort_order`, exerciseID)
	if err != nil {
		return zero, err
	}
	defer rows.Close()
	var paths []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return zero, err
		}
		paths = append(paths, p)
	}
	if err := rows.Err(); err != nil {
		return zero, err
	}
	if len(paths) == 0 {
		var legacy string
		_ = tx.QueryRowContext(ctx, `SELECT image_path FROM exercises WHERE id = ?`, exerciseID).Scan(&legacy)
		if legacy != "" {
			paths = []string{legacy}
		}
	}
	if pageIndex < 0 || pageIndex >= len(paths) {
		return zero, ErrInvalidPage
	}

	if len(paths) == 1 {
		if _, err := tx.ExecContext(ctx, `DELETE FROM exercises WHERE id = ?`, exerciseID); err != nil {
			return zero, err
		}
		if err := tx.Commit(); err != nil {
			return zero, err
		}
		return RemovePageResult{ExerciseDeleted: true, FilesToRemove: paths}, nil
	}

	removed := paths[pageIndex]
	newPaths := append(paths[:pageIndex], paths[pageIndex+1:]...)

	if _, err := tx.ExecContext(ctx, `DELETE FROM exercise_pages WHERE exercise_id = ?`, exerciseID); err != nil {
		return zero, err
	}
	for i := range newPaths {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO exercise_pages (exercise_id, sort_order, image_path) VALUES (?, ?, ?)`,
			exerciseID, i, newPaths[i]); err != nil {
			return zero, err
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE exercises SET image_path = ? WHERE id = ?`, newPaths[0], exerciseID); err != nil {
		return zero, err
	}
	if err := tx.Commit(); err != nil {
		return zero, err
	}
	return RemovePageResult{ImagePaths: newPaths, FilesToRemove: []string{removed}}, nil
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
	if err != nil {
		return err
	}
	if next == 0 {
		_, err = s.db.ExecContext(ctx, `
			UPDATE exercises SET image_path = ? WHERE id = ?`, imagePath, exerciseID)
	}
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
		UPDATE exercises SET title = ?, passage = ?, status = 'parsed',
			speed_read_segments_json = '', speed_read_segments_passage = ''
		WHERE id = ?`, title, passage, id)
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
	var assignID sql.NullString
	var speedJSON, speedPassage sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT id, title, passage, image_path, status, created_at, completed_at, answers_json, score_percent,
		       assignment_id, assignment_sort,
		       ifnull(speed_read_segments_json, ''), ifnull(speed_read_segments_passage, '')
		FROM exercises WHERE id = ?`, id).Scan(
		&ex.ID, &ex.Title, &ex.Passage, &ex.ImagePath, &ex.Status, &created, &completed, &ex.AnswersJSON, &ex.ScorePercent,
		&assignID, &ex.AssignmentSort, &speedJSON, &speedPassage)
	if assignID.Valid {
		ex.AssignmentID = assignID.String
	}
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
	if speedPassage.Valid && speedPassage.String == ex.Passage && speedJSON.Valid && strings.TrimSpace(speedJSON.String) != "" {
		var segs []string
		if err := json.Unmarshal([]byte(speedJSON.String), &segs); err == nil && len(segs) > 0 {
			ex.SpeedReadHTMLSegments = segs
		}
	}
	return &ex, list, nil
}

// SaveSpeedReadSegments persists bunsetsu HTML segments for the current passage (must match exercises.passage).
func (s *Store) SaveSpeedReadSegments(ctx context.Context, exerciseID, passage string, htmlSegments []string) error {
	b, err := json.Marshal(htmlSegments)
	if err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `
		UPDATE exercises SET speed_read_segments_json = ?, speed_read_segments_passage = ?
		WHERE id = ?`, string(b), passage, exerciseID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
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
		SELECT id, title, passage, image_path, status, created_at, completed_at, score_percent,
		       assignment_id, assignment_sort
		FROM exercises ORDER BY created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Exercise
	for rows.Next() {
		var ex Exercise
		var created, completed sql.NullString
		var assignID sql.NullString
		if err := rows.Scan(&ex.ID, &ex.Title, &ex.Passage, &ex.ImagePath, &ex.Status, &created, &completed, &ex.ScorePercent,
			&assignID, &ex.AssignmentSort); err != nil {
			return nil, err
		}
		if assignID.Valid {
			ex.AssignmentID = assignID.String
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

// DeleteExercise removes the exercise (or the whole assignment when deleting the primary exercise at assignmentSort 0).
// Returns image paths that are no longer referenced and may be unlinked on disk.
func (s *Store) DeleteExercise(ctx context.Context, id string) ([]string, error) {
	return s.deleteExerciseOrAssignment(ctx, id)
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

// SavePrintSummary upserts the AI summary for one assignment (print).
func (s *Store) SavePrintSummary(ctx context.Context, assignmentID, summaryJSON string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO print_summaries (assignment_id, summary_json, created_at)
		VALUES (?, ?, ?)
		ON CONFLICT(assignment_id) DO UPDATE SET summary_json = excluded.summary_json, created_at = excluded.created_at`,
		assignmentID, summaryJSON, now)
	return err
}

// GetPrintSummary returns JSON for a print-level summary, or empty string if none.
func (s *Store) GetPrintSummary(ctx context.Context, assignmentID string) (string, error) {
	var j string
	err := s.db.QueryRowContext(ctx, `SELECT summary_json FROM print_summaries WHERE assignment_id = ?`, assignmentID).Scan(&j)
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

// ReplaceVocabCardsForAssignment deletes vocab rows for every exercise in the assignment, then inserts items
// under anchorExerciseID (typically だい1). Used when a print-level summary replaces per-exercise vocabulary.
func (s *Store) ReplaceVocabCardsForAssignment(ctx context.Context, assignmentID, anchorExerciseID string, items []VocabItem) error {
	if strings.TrimSpace(anchorExerciseID) == "" {
		return errors.New("anchor exercise id required")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM vocab_cards WHERE source_exercise_id IN (
			SELECT id FROM exercises WHERE assignment_id = ?
		)`, assignmentID); err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, it := range items {
		ex, _ := json.Marshal(it.Examples)
		id := uuid.NewString()
		_, err := tx.ExecContext(ctx, `
			INSERT INTO vocab_cards (id, word, reading, meaning, examples_json, source_exercise_id, created_at, review_count)
			VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
			id, it.Word, it.Reading, it.Meaning, string(ex), anchorExerciseID, now)
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
	list, err := scanVocabRows(rows)
	if err != nil {
		return nil, err
	}
	return dedupeVocabCards(list), nil
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
	list, err := scanVocabRows(rows)
	if err != nil {
		return nil, err
	}
	return dedupeVocabCards(list), nil
}

func dedupeVocabCards(cards []VocabCard) []VocabCard {
	if len(cards) < 2 {
		return cards
	}
	seen := make(map[string]struct{}, len(cards))
	out := make([]VocabCard, 0, len(cards))
	for _, c := range cards {
		r := strings.TrimSpace(c.Reading)
		surf := textnorm.PlainForDedupe(c.Word)
		if surf == "" && r == "" {
			continue
		}
		key := surf + "\x00" + r
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, c)
	}
	return out
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
