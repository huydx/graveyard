package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ParsedExerciseBlock is one exercise unit after worksheet parse (title, passage, questions).
type ParsedExerciseBlock struct {
	Title     string
	Passage   string
	Questions []Question
}

// AssignmentGroup is one weekly (or multi-exercise) scan for history / prints UI.
type AssignmentGroup struct {
	ID        string     `json:"id"`
	Title     string     `json:"title"`
	CreatedAt time.Time  `json:"createdAt"`
	Exercises []Exercise `json:"exercises"`
}

func (s *Store) exercisePagePathsTx(ctx context.Context, tx *sql.Tx, exerciseID string) ([]string, error) {
	rows, err := tx.QueryContext(ctx, `
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(paths) == 0 {
		var legacy string
		_ = tx.QueryRowContext(ctx, `SELECT image_path FROM exercises WHERE id = ?`, exerciseID).Scan(&legacy)
		if legacy != "" {
			paths = []string{legacy}
		}
	}
	return paths, nil
}

func (s *Store) copyExercisePagesTx(ctx context.Context, tx *sql.Tx, fromID, toID string) error {
	paths, err := s.exercisePagePathsTx(ctx, tx, fromID)
	if err != nil {
		return err
	}
	for i, p := range paths {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO exercise_pages (exercise_id, sort_order, image_path) VALUES (?, ?, ?)`,
			toID, i, p); err != nil {
			return err
		}
	}
	if len(paths) > 0 {
		if _, err := tx.ExecContext(ctx, `UPDATE exercises SET image_path = ? WHERE id = ?`, paths[0], toID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) setExerciseParsedTx(ctx context.Context, tx *sql.Tx, id, title, passage string) error {
	res, err := tx.ExecContext(ctx, `
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

func (s *Store) replaceQuestionsTx(ctx context.Context, tx *sql.Tx, exerciseID string, qs []Question) error {
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
	return nil
}

// PrimaryExerciseID returns the exercise with assignment_sort 0 for this assignment.
func (s *Store) PrimaryExerciseID(ctx context.Context, assignmentID string) (string, error) {
	var id string
	err := s.db.QueryRowContext(ctx, `
		SELECT id FROM exercises WHERE assignment_id = ? AND assignment_sort = 0`, assignmentID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", sql.ErrNoRows
	}
	return id, err
}

// EnsureAssignment creates an assignment row and attaches the exercise if it was missing (legacy rows).
func (s *Store) EnsureAssignment(ctx context.Context, exerciseID string) error {
	var assignID sql.NullString
	var created string
	err := s.db.QueryRowContext(ctx, `
		SELECT assignment_id, created_at FROM exercises WHERE id = ?`, exerciseID).Scan(&assignID, &created)
	if err != nil {
		return err
	}
	if assignID.Valid && strings.TrimSpace(assignID.String) != "" {
		return nil
	}
	aid := uuid.NewString()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `INSERT INTO assignments (id, created_at, subject) VALUES (?, ?, 'kokugo')`, aid, created); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE exercises SET assignment_id = ?, assignment_sort = 0 WHERE id = ?`, aid, exerciseID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) AssignmentSubject(ctx context.Context, assignmentID string) (string, error) {
	var subject string
	err := s.db.QueryRowContext(ctx, `SELECT ifnull(subject, 'kokugo') FROM assignments WHERE id = ?`, assignmentID).Scan(&subject)
	if err != nil {
		return "", err
	}
	return strings.ToLower(strings.TrimSpace(subject)), nil
}

// ListExercisesInAssignment returns exercises ordered by assignment_sort.
func (s *Store) ListExercisesInAssignment(ctx context.Context, assignmentID string) ([]Exercise, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, title, passage, image_path, status, created_at, completed_at, answers_json, score_percent,
		       assignment_id, assignment_sort
		FROM exercises WHERE assignment_id = ? ORDER BY assignment_sort`, assignmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Exercise
	for rows.Next() {
		var ex Exercise
		var created, completed sql.NullString
		var aid sql.NullString
		if err := rows.Scan(&ex.ID, &ex.Title, &ex.Passage, &ex.ImagePath, &ex.Status, &created, &completed,
			&ex.AnswersJSON, &ex.ScorePercent, &aid, &ex.AssignmentSort); err != nil {
			return nil, err
		}
		if aid.Valid {
			ex.AssignmentID = aid.String
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

// GetAssignmentGroup loads one assignment and its exercises.
func (s *Store) GetAssignmentGroup(ctx context.Context, assignmentID string) (*AssignmentGroup, error) {
	var created, title string
	err := s.db.QueryRowContext(ctx, `
		SELECT created_at, ifnull(title, '') FROM assignments WHERE id = ?`, assignmentID).Scan(&created, &title)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	exs, err := s.ListExercisesInAssignment(ctx, assignmentID)
	if err != nil {
		return nil, err
	}
	t, _ := time.Parse(time.RFC3339, created)
	return &AssignmentGroup{ID: assignmentID, Title: title, CreatedAt: t, Exercises: exs}, nil
}

// UpdateAssignmentTitle sets the user-visible print title (assignment row).
func (s *Store) UpdateAssignmentTitle(ctx context.Context, assignmentID, title string) error {
	res, err := s.db.ExecContext(ctx, `UPDATE assignments SET title = ? WHERE id = ?`, title, assignmentID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ListAssignmentsForHistory returns recent assignments with nested exercises.
func (s *Store) ListAssignmentsForHistory(ctx context.Context, limit int) ([]AssignmentGroup, error) {
	return s.ListAssignmentsForHistoryBySubject(ctx, limit, "kokugo")
}

func (s *Store) ListAssignmentsForHistoryBySubject(ctx context.Context, limit int, subject string) ([]AssignmentGroup, error) {
	if limit <= 0 {
		limit = 50
	}
	subject = strings.ToLower(strings.TrimSpace(subject))
	if subject == "" {
		subject = "kokugo"
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, created_at, ifnull(title, '') FROM assignments
		WHERE ifnull(subject, 'kokugo') = ?
		ORDER BY datetime(created_at) DESC LIMIT ?`, subject, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	var times []time.Time
	var titles []string
	for rows.Next() {
		var id, ts, title string
		if err := rows.Scan(&id, &ts, &title); err != nil {
			return nil, err
		}
		t, _ := time.Parse(time.RFC3339, ts)
		ids = append(ids, id)
		times = append(times, t)
		titles = append(titles, title)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]AssignmentGroup, 0, len(ids))
	for i, aid := range ids {
		exs, err := s.ListExercisesInAssignment(ctx, aid)
		if err != nil {
			return nil, err
		}
		if len(exs) == 0 {
			_, _ = s.db.ExecContext(ctx, `DELETE FROM assignments WHERE id = ?`, aid)
			continue
		}
		out = append(out, AssignmentGroup{ID: aid, Title: titles[i], CreatedAt: times[i], Exercises: exs})
	}
	return out, nil
}

// SyncAssignmentFromParsed applies parse blocks starting at sourceExerciseID (must be draft, with images).
// Earlier exercises in the assignment are left unchanged; trailing rows from the same scan tail may be removed.
func (s *Store) SyncAssignmentFromParsed(ctx context.Context, sourceExerciseID string, blocks []ParsedExerciseBlock) error {
	if len(blocks) == 0 {
		return errors.New("parse結果が空です")
	}
	if err := s.EnsureAssignment(ctx, sourceExerciseID); err != nil {
		return err
	}
	source, _, err := s.GetExercise(ctx, sourceExerciseID)
	if err != nil {
		return err
	}
	if source.Status != "draft" {
		return errors.New("下書きの演習だけよみとれます")
	}
	aid := source.AssignmentID
	if aid == "" {
		return errors.New("assignment_id が設定されていません")
	}
	existing, err := s.ListExercisesInAssignment(ctx, aid)
	if err != nil {
		return err
	}
	start := -1
	for i := range existing {
		if existing[i].ID == sourceExerciseID {
			start = i
			break
		}
	}
	if start < 0 {
		return fmt.Errorf("assignment 内に演習が見つかりません")
	}

	const maxBlocks = 24
	if len(blocks) > maxBlocks {
		blocks = blocks[:maxBlocks]
	}
	nBlocks := len(blocks)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var blockEids []string
	for i := 0; i < nBlocks; i++ {
		idx := start + i
		var eid string
		if idx < len(existing) {
			eid = existing[idx].ID
		} else {
			newID := uuid.NewString()
			ts := time.Now().UTC().Format(time.RFC3339)
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO exercises (id, title, passage, image_path, status, created_at, assignment_id, assignment_sort, answers_json, score_percent)
				VALUES (?, '', '', '', 'parsed', ?, ?, 999, '{}', 0)`,
				newID, ts, aid); err != nil {
				return err
			}
			if err := s.copyExercisePagesTx(ctx, tx, sourceExerciseID, newID); err != nil {
				return err
			}
			eid = newID
		}
		blockEids = append(blockEids, eid)
		if err := s.setExerciseParsedTx(ctx, tx, eid, blocks[i].Title, blocks[i].Passage); err != nil {
			return err
		}
		if err := s.replaceQuestionsTx(ctx, tx, eid, blocks[i].Questions); err != nil {
			return err
		}
	}

	for j := start + nBlocks; j < len(existing); j++ {
		if _, err := tx.ExecContext(ctx, `DELETE FROM exercises WHERE id = ?`, existing[j].ID); err != nil {
			return err
		}
	}

	prefix := make([]string, 0, start)
	for i := 0; i < start; i++ {
		prefix = append(prefix, existing[i].ID)
	}
	ordered := append(prefix, blockEids...)
	for sort, eid := range ordered {
		if _, err := tx.ExecContext(ctx, `
			UPDATE exercises SET assignment_sort = ? WHERE id = ? AND assignment_id = ?`,
			sort, eid, aid); err != nil {
			return err
		}
	}

	var nLeft int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM exercises WHERE assignment_id = ?`, aid).Scan(&nLeft); err != nil {
		return err
	}
	if nLeft == 0 {
		return errors.New("assignment に演習が残りませんでした")
	}

	return tx.Commit()
}

func (s *Store) deleteExerciseOrAssignment(ctx context.Context, id string) ([]string, error) {
	ex, _, err := s.GetExercise(ctx, id)
	if err != nil {
		return nil, err
	}

	collectPaths := func(tx *sql.Tx, exerciseIDs []string) (map[string]struct{}, error) {
		seen := make(map[string]struct{})
		for _, eid := range exerciseIDs {
			paths, err := s.exercisePagePathsTx(ctx, tx, eid)
			if err != nil {
				return nil, err
			}
			for _, p := range paths {
				if p != "" {
					seen[p] = struct{}{}
				}
			}
		}
		return seen, nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	var idsToDelete []string
	var assignmentID string
	if ex.AssignmentID != "" && ex.AssignmentSort == 0 {
		rows, err := tx.QueryContext(ctx, `
			SELECT id FROM exercises WHERE assignment_id = ? ORDER BY assignment_sort`, ex.AssignmentID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var eid string
			if err := rows.Scan(&eid); err != nil {
				rows.Close()
				return nil, err
			}
			idsToDelete = append(idsToDelete, eid)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
		assignmentID = ex.AssignmentID
	} else {
		idsToDelete = []string{id}
		if ex.AssignmentID != "" {
			assignmentID = ex.AssignmentID
		}
	}

	pathSet, err := collectPaths(tx, idsToDelete)
	if err != nil {
		return nil, err
	}

	for _, eid := range idsToDelete {
		if _, err := tx.ExecContext(ctx, `DELETE FROM exercises WHERE id = ?`, eid); err != nil {
			return nil, err
		}
	}

	if assignmentID != "" {
		var n int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM exercises WHERE assignment_id = ?`, assignmentID).Scan(&n); err != nil {
			return nil, err
		}
		if n == 0 {
			if _, err := tx.ExecContext(ctx, `DELETE FROM assignments WHERE id = ?`, assignmentID); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	var toUnlink []string
	for p := range pathSet {
		var cntPages int
		_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM exercise_pages WHERE image_path = ?`, p).Scan(&cntPages)
		var cntLegacy int
		_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM exercises WHERE image_path = ?`, p).Scan(&cntLegacy)
		if cntPages == 0 && cntLegacy == 0 {
			toUnlink = append(toUnlink, p)
		}
	}
	return toUnlink, nil
}
