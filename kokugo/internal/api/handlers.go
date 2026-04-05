package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/huydx/kokugo/internal/ai"
	"github.com/huydx/kokugo/internal/config"
	"github.com/huydx/kokugo/internal/store"
)

const maxExercisePages = 12

type Server struct {
	Cfg   config.Config
	Store *store.Store
	llm   atomic.Pointer[llmRuntime]
}

func (s *Server) json(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) err(w http.ResponseWriter, status int, msg string) {
	s.json(w, status, map[string]string{"error": msg})
}

func (s *Server) Health(w http.ResponseWriter, r *http.Request) {
	rt := s.lm()
	s.json(w, http.StatusOK, map[string]any{
		"geminiConnected":    rt.imageParser != nil,
		"speechTranscribeOK": rt.transcribeOK && rt.summaryChat != nil,
		"childName":          s.Cfg.ChildName,
		"chatBackend":        rt.effSummaryBackend,
		"chatBackendSummary": rt.effSummaryBackend,
		"chatBackendJudge":   rt.effJudgeBackend,
		"ollamaBaseUrl":      rt.effOllamaURL,
	})
}

func (s *Server) TranscribeAudio(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	rt := s.lm()
	if rt.summaryChat == nil || !rt.transcribeOK {
		s.err(w, http.StatusServiceUnavailable, "音声の文字おこしは要約まわりを Gemini にする必要があります（KOKUGO_CHAT_BACKEND_SUMMARY=gemini と GOOGLE_API_KEY）")
		return
	}
	_ = r.ParseMultipartForm(16 << 20)
	file, hdr, err := r.FormFile("audio")
	if err != nil {
		s.err(w, http.StatusBadRequest, "音声ファイル audio が必要です")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil || len(data) == 0 {
		s.err(w, http.StatusBadRequest, "音声を読めませんでした")
		return
	}
	if len(data) > 12<<20 {
		s.err(w, http.StatusBadRequest, "音声が大きすぎます")
		return
	}
	mime := hdr.Header.Get("Content-Type")
	if mime == "" || mime == "application/octet-stream" {
		mime = ""
	}
	fn := strings.ToLower(hdr.Filename)
	switch {
	case strings.HasSuffix(fn, ".webm"):
		mime = "audio/webm"
	case strings.HasSuffix(fn, ".m4a"), strings.HasSuffix(fn, ".mp4"), strings.HasSuffix(fn, ".aac"):
		mime = "audio/mp4"
	}
	if mime == "" {
		mime = "audio/mp4"
	}
	text, err := ai.TranscribeAnswerAudio(r.Context(), rt.summaryChat, rt.summaryModel, data, mime)
	if err != nil {
		log.Printf("transcribe: %v", err)
		s.err(w, http.StatusBadGateway, "文字おこしに失敗しました")
		return
	}
	s.json(w, http.StatusOK, map[string]string{"text": text})
}

func (s *Server) UploadScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	_ = r.ParseMultipartForm(32 << 20)
	file, hdr, err := r.FormFile("image")
	if err != nil {
		s.err(w, http.StatusBadRequest, "画像ファイル image が必要です")
		return
	}
	defer file.Close()
	ext := strings.ToLower(filepath.Ext(hdr.Filename))
	if ext == "" {
		ext = ".jpg"
	}
	data, err := io.ReadAll(file)
	if err != nil || len(data) == 0 {
		s.err(w, http.StatusBadRequest, "画像を読めませんでした")
		return
	}
	if err := os.MkdirAll(s.Cfg.UploadsDir, 0o755); err != nil {
		s.err(w, http.StatusInternalServerError, "保存先を作れません")
		return
	}
	name := time.Now().UTC().Format("20060102_150405") + "_" + randomName() + ext
	path := filepath.Join(s.Cfg.UploadsDir, name)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		s.err(w, http.StatusInternalServerError, "画像の保存に失敗しました")
		return
	}
	ex, err := s.Store.CreateExerciseDraft(r.Context(), path)
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{
		"exerciseId": ex.ID, "imagePath": path, "imagePaths": ex.ImagePaths,
	})
}

// CreatePrint creates an empty assignment + draft exercise (no images). JSON body must include a non-empty "title".
func (s *Server) CreatePrint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&body); err != nil {
		if !errors.Is(err, io.EOF) {
			s.err(w, http.StatusBadRequest, "JSONが読めません")
			return
		}
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		s.err(w, http.StatusBadRequest, "なまえをいれてください")
		return
	}
	if utf8.RuneCountInString(title) > 200 {
		s.err(w, http.StatusBadRequest, "タイトルは200文字以内にしてください")
		return
	}
	ex, err := s.Store.CreateEmptyPrintDraft(r.Context())
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.Store.UpdateAssignmentTitle(r.Context(), ex.AssignmentID, title); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{
		"exerciseId":   ex.ID,
		"assignmentId": ex.AssignmentID,
	})
}

// GetPrint returns one assignment (print) with exercises and primaryExerciseId for scanning.
func (s *Server) GetPrint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.err(w, http.StatusMethodNotAllowed, "GET のみ")
		return
	}
	aid := r.PathValue("id")
	if aid == "" {
		s.err(w, http.StatusBadRequest, "プリントIDが不正です")
		return
	}
	g, err := s.Store.GetAssignmentGroup(r.Context(), aid)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			s.err(w, http.StatusNotFound, "見つかりません")
			return
		}
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	pid := ""
	if len(g.Exercises) > 0 {
		pid = g.Exercises[0].ID
	}
	s.json(w, http.StatusOK, map[string]any{
		"print":             g,
		"primaryExerciseId": pid,
	})
}

// PatchPrint updates user-editable print fields (assignment title).
func (s *Server) PatchPrint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		s.err(w, http.StatusMethodNotAllowed, "PATCH のみ")
		return
	}
	aid := r.PathValue("id")
	if aid == "" {
		s.err(w, http.StatusBadRequest, "プリントIDが不正です")
		return
	}
	var body struct {
		Title *string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが読めません")
		return
	}
	if body.Title == nil {
		s.err(w, http.StatusBadRequest, "title が必要です")
		return
	}
	title := strings.TrimSpace(*body.Title)
	if utf8.RuneCountInString(title) > 200 {
		s.err(w, http.StatusBadRequest, "タイトルは200文字以内にしてください")
		return
	}
	if err := s.Store.UpdateAssignmentTitle(r.Context(), aid, title); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			s.err(w, http.StatusNotFound, "見つかりません")
			return
		}
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true, "title": title})
}

// EnsureScanDraft returns the draft exercise to attach scan pages to: reuses the last row if it is draft, otherwise appends a new draft.
func (s *Server) EnsureScanDraft(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	aid := r.PathValue("id")
	if aid == "" {
		s.err(w, http.StatusBadRequest, "プリントIDが不正です")
		return
	}
	g, err := s.Store.GetAssignmentGroup(r.Context(), aid)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			s.err(w, http.StatusNotFound, "見つかりません")
			return
		}
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(g.Exercises) == 0 {
		s.err(w, http.StatusBadRequest, "このプリントには演習がありません")
		return
	}
	last := g.Exercises[len(g.Exercises)-1]
	if last.Status == "draft" {
		s.json(w, http.StatusOK, map[string]any{"exerciseId": last.ID})
		return
	}
	ex, err := s.Store.AppendDraftExerciseToAssignment(r.Context(), aid)
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{"exerciseId": ex.ID})
}

func randomName() string {
	return strconv.FormatInt(time.Now().UnixNano(), 36)
}

func (s *Server) ParseExercise(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	rt := s.lm()
	if rt.imageParser == nil {
		s.err(w, http.StatusServiceUnavailable, "画像の解析ができません（Gemini API キーを GOOGLE_API_KEY またはせっていで指定してください）")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	ex, _, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	if ex.Status != "draft" {
		s.err(w, http.StatusConflict, "下書きのときだけよみとれます")
		return
	}
	if err := s.Store.EnsureAssignment(r.Context(), id); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	paths := ex.ImagePaths
	if len(paths) == 0 && ex.ImagePath != "" {
		paths = []string{ex.ImagePath}
	}
	if len(paths) == 0 {
		s.err(w, http.StatusBadRequest, "画像がありません")
		return
	}
	if len(paths) > maxExercisePages {
		s.err(w, http.StatusBadRequest, "ページが多すぎます（最大12枚）")
		return
	}
	var pages []ai.ImagePart
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			s.err(w, http.StatusInternalServerError, "画像ファイルを読めません")
			return
		}
		pages = append(pages, ai.ImagePart{Data: data, MIME: mimeForPath(p)})
	}
	parsedList, err := rt.imageParser.ParseExercisePages(r.Context(), pages)
	if err != nil {
		log.Printf("parse: %v", err)
		s.err(w, http.StatusBadGateway, "AIの解析に失敗しました: "+err.Error())
		return
	}
	var blocks []store.ParsedExerciseBlock
	var totalQ int
	for _, pe := range parsedList {
		var qs []store.Question
		for _, q := range pe.Questions {
			qt := strings.ToLower(strings.TrimSpace(q.Type))
			if qt != "voice" && qt != "choice" {
				if len(q.Options) >= 2 {
					qt = "choice"
				} else {
					qt = "voice"
				}
			}
			qs = append(qs, store.Question{
				Type:          qt,
				Prompt:        q.Prompt,
				Options:       q.Options,
				CorrectAnswer: q.Correct,
				FocusWord:     q.FocusWord,
			})
		}
		totalQ += len(qs)
		blocks = append(blocks, store.ParsedExerciseBlock{
			Title: pe.Title, Passage: pe.Passage, Questions: qs,
		})
	}
	if err := s.Store.SyncAssignmentFromParsed(r.Context(), id, blocks); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	exAfter, _, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	sibs, _ := s.Store.ListExercisesInAssignment(r.Context(), exAfter.AssignmentID)
	var exIDs []string
	primaryOut := ""
	for _, e := range sibs {
		exIDs = append(exIDs, e.ID)
	}
	if len(sibs) > 0 {
		primaryOut = sibs[0].ID
	}
	firstTitle := ""
	if len(blocks) > 0 {
		firstTitle = blocks[0].Title
	}
	s.json(w, http.StatusOK, map[string]any{
		"ok":                true,
		"title":             firstTitle,
		"questionCount":     totalQ,
		"exerciseCount":     len(blocks),
		"exerciseIds":       exIDs,
		"primaryExerciseId": primaryOut,
	})
}

func mimeForPath(p string) string {
	switch strings.ToLower(filepath.Ext(p)) {
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "image/jpeg"
	}
}

func (s *Server) ExerciseImage(w http.ResponseWriter, r *http.Request) {
	s.serveExerciseImageAt(w, r, 0)
}

func (s *Server) ExerciseImagePage(w http.ResponseWriter, r *http.Request) {
	pageStr := r.PathValue("pageIndex")
	idx, err := strconv.Atoi(pageStr)
	if err != nil || idx < 0 {
		s.err(w, http.StatusBadRequest, "ページ番号が不正です")
		return
	}
	s.serveExerciseImageAt(w, r, idx)
}

func (s *Server) serveExerciseImageAt(w http.ResponseWriter, r *http.Request, idx int) {
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	ex, _, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	paths := ex.ImagePaths
	if len(paths) == 0 && ex.ImagePath != "" {
		paths = []string{ex.ImagePath}
	}
	if len(paths) == 0 {
		s.err(w, http.StatusNotFound, "画像がありません")
		return
	}
	if idx >= len(paths) {
		s.err(w, http.StatusNotFound, "ページがありません")
		return
	}
	http.ServeFile(w, r, paths[idx])
}

func (s *Server) AddExercisePage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	ex, _, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	if ex.Status != "draft" {
		s.err(w, http.StatusConflict, "下書きのときだけページを追加できます")
		return
	}
	paths := ex.ImagePaths
	if len(paths) == 0 && ex.ImagePath != "" {
		paths = []string{ex.ImagePath}
	}
	if len(paths) >= maxExercisePages {
		s.err(w, http.StatusBadRequest, "ページは最大12枚までです")
		return
	}
	_ = r.ParseMultipartForm(32 << 20)
	file, hdr, err := r.FormFile("image")
	if err != nil {
		s.err(w, http.StatusBadRequest, "画像ファイル image が必要です")
		return
	}
	defer file.Close()
	ext := strings.ToLower(filepath.Ext(hdr.Filename))
	if ext == "" {
		ext = ".jpg"
	}
	data, err := io.ReadAll(file)
	if err != nil || len(data) == 0 {
		s.err(w, http.StatusBadRequest, "画像を読めませんでした")
		return
	}
	if err := os.MkdirAll(s.Cfg.UploadsDir, 0o755); err != nil {
		s.err(w, http.StatusInternalServerError, "保存先を作れません")
		return
	}
	name := time.Now().UTC().Format("20060102_150405") + "_" + randomName() + ext
	path := filepath.Join(s.Cfg.UploadsDir, name)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		s.err(w, http.StatusInternalServerError, "画像の保存に失敗しました")
		return
	}
	if err := s.Store.AddExercisePage(r.Context(), id, path); err != nil {
		_ = os.Remove(path)
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	ex2, _, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true, "imagePaths": ex2.ImagePaths})
}

func (s *Server) DeleteExercisePage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		s.err(w, http.StatusMethodNotAllowed, "DELETE のみ")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	pageStr := r.PathValue("pageIndex")
	idx, err := strconv.Atoi(pageStr)
	if err != nil || idx < 0 {
		s.err(w, http.StatusBadRequest, "ページ番号が不正です")
		return
	}
	res, err := s.Store.RemoveExercisePageAt(r.Context(), id, idx)
	if errors.Is(err, sql.ErrNoRows) {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	if errors.Is(err, store.ErrNotDraft) {
		s.err(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, store.ErrInvalidPage) {
		s.err(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, p := range res.FilesToRemove {
		_ = os.Remove(p)
	}
	if res.ExerciseDeleted {
		s.json(w, http.StatusOK, map[string]any{"exerciseDeleted": true})
		return
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true, "imagePaths": res.ImagePaths})
}

func (s *Server) DeleteExercise(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		s.err(w, http.StatusMethodNotAllowed, "DELETE のみ")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	paths, err := s.Store.DeleteExercise(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, p := range paths {
		_ = os.Remove(p)
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) GetExercise(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	ex, qs, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	pub := make([]map[string]any, 0, len(qs))
	for _, q := range qs {
		pub = append(pub, map[string]any{
			"id": q.ID, "exerciseId": q.ExerciseID, "sortOrder": q.SortOrder,
			"type": q.Type, "prompt": q.Prompt, "options": q.Options, "focusWord": q.FocusWord,
			"scorable": strings.TrimSpace(q.CorrectAnswer) != "",
		})
	}
	out := map[string]any{"exercise": ex, "questions": pub}
	if ex.AssignmentID != "" {
		sibs, err := s.Store.ListExercisesInAssignment(r.Context(), ex.AssignmentID)
		if err == nil && len(sibs) > 0 {
			rows := make([]map[string]any, 0, len(sibs))
			for _, e := range sibs {
				rows = append(rows, map[string]any{
					"id":             e.ID,
					"title":          e.Title,
					"assignmentSort": e.AssignmentSort,
					"status":         e.Status,
					"scorePercent":   e.ScorePercent,
				})
			}
			out["assignment"] = map[string]any{
				"id":        ex.AssignmentID,
				"exercises": rows,
			}
		}
	}
	s.json(w, http.StatusOK, out)
}

type submitBody struct {
	Answers map[string]string `json:"answers"`
}

func (s *Server) SubmitAnswers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	var body submitBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが不正です")
		return
	}
	ex, qs, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	rt := s.lm()
	var merged []ai.AnswerJudgment
	if rt.judgeChat != nil {
		items := buildAnswerJudgeItemsLLM(body.Answers, qs)
		if len(items) > 0 {
			log.Printf("judge_http: op=submit exercise_id=%s backend=%s model=%s llm_voice_items=%d questions_total=%d",
				id, rt.effJudgeBackend, rt.judgeModel, len(items), len(qs))
			judgments, err := ai.JudgeExerciseAnswers(r.Context(), rt.judgeChat, rt.judgeModel, ex.Title, ex.Passage, items)
			if err != nil {
				log.Printf("judge_http: op=submit exercise_id=%s backend=%s model=%s FAILED err=%v", id, rt.effJudgeBackend, rt.judgeModel, err)
				s.err(w, http.StatusBadGateway, "AIの採点に失敗しました: "+err.Error())
				return
			}
			merged = mergeQuestionResults(qs, judgments, body.Answers)
		} else {
			merged = mergeQuestionResults(qs, nil, body.Answers)
		}
	} else {
		merged = legacyJudgmentsForExercise(qs, body.Answers)
	}
	correct := countCorrectWithJudgments(qs, judgmentsToMap(merged))
	pct := 0
	if len(qs) > 0 {
		pct = (correct * 100) / len(qs)
	}
	if err := s.Store.SaveAnswersAndComplete(r.Context(), id, body.Answers, pct); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{
		"scorePercent":    pct,
		"correct":         correct,
		"total":           len(qs),
		"questionResults": wireQuestionResults(qs, body.Answers, merged),
	})
}

type checkQuestionBody struct {
	Answer string `json:"answer"`
}

func (s *Server) CheckQuestion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	eid := r.PathValue("id")
	qid := r.PathValue("questionId")
	if eid == "" || qid == "" {
		s.err(w, http.StatusBadRequest, "IDが不正です")
		return
	}
	var body checkQuestionBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが不正です")
		return
	}
	ex, qs, err := s.Store.GetExercise(r.Context(), eid)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	var q *store.Question
	for i := range qs {
		if qs[i].ID == qid {
			q = &qs[i]
			break
		}
	}
	if q == nil {
		s.err(w, http.StatusNotFound, "もんだいが見つかりません")
		return
	}
	if strings.TrimSpace(q.CorrectAnswer) == "" {
		s.err(w, http.StatusBadRequest, "このもんだいは自動さいていのたいしょう外です")
		return
	}
	ua := strings.TrimSpace(body.Answer)
	rt := s.lm()
	var j ai.AnswerJudgment
	if rt.judgeChat != nil && isVoiceQuestion(q) {
		items := []ai.AnswerJudgeItem{{
			ID: q.ID, Type: q.Type, Prompt: q.Prompt, Options: q.Options,
			Correct: q.CorrectAnswer, UserAnswer: ua,
		}}
		log.Printf("judge_http: op=check_question exercise_id=%s question_id=%s backend=%s model=%s answer_runes=%d q_type=%s (llm)",
			eid, qid, rt.effJudgeBackend, rt.judgeModel, utf8.RuneCountInString(ua), q.Type)
		list, err := ai.JudgeExerciseAnswers(r.Context(), rt.judgeChat, rt.judgeModel, ex.Title, ex.Passage, items)
		if err != nil {
			log.Printf("judge_http: op=check_question exercise_id=%s question_id=%s backend=%s model=%s FAILED err=%v",
				eid, qid, rt.effJudgeBackend, rt.judgeModel, err)
			s.err(w, http.StatusBadGateway, "AIの採点に失敗しました: "+err.Error())
			return
		}
		if len(list) != 1 {
			j = legacyAnswerJudgment(q, ua)
		} else {
			j = list[0]
		}
	} else {
		if rt.judgeChat != nil {
			log.Printf("judge_http: op=check_question exercise_id=%s question_id=%s q_type=%s (text_only)",
				eid, qid, q.Type)
		}
		j = legacyAnswerJudgment(q, ua)
	}
	s.json(w, http.StatusOK, map[string]any{
		"questionId": q.ID,
		"prompt":     q.Prompt,
		"isCorrect":  j.IsCorrect,
		"feedback":   j.Feedback,
	})
}

// GetQuestionSolution returns the model answer for study (not included in GET exercise).
func (s *Server) GetQuestionSolution(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.err(w, http.StatusMethodNotAllowed, "GET のみ")
		return
	}
	eid := r.PathValue("id")
	qid := r.PathValue("questionId")
	if eid == "" || qid == "" {
		s.err(w, http.StatusBadRequest, "IDが不正です")
		return
	}
	_, qs, err := s.Store.GetExercise(r.Context(), eid)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	var q *store.Question
	for i := range qs {
		if qs[i].ID == qid {
			q = &qs[i]
			break
		}
	}
	if q == nil {
		s.err(w, http.StatusNotFound, "もんだいが見つかりません")
		return
	}
	if strings.TrimSpace(q.CorrectAnswer) == "" {
		s.err(w, http.StatusBadRequest, "このもんだいはせいかいがきろくされていません")
		return
	}
	s.json(w, http.StatusOK, map[string]any{"correctAnswer": q.CorrectAnswer})
}

func norm(s string) string {
	return strings.TrimSpace(strings.ToLower(s))
}

// isVoiceQuestion is true for free-text / voice answers. Choice questions use text comparison only.
func isVoiceQuestion(q *store.Question) bool {
	return strings.EqualFold(strings.TrimSpace(q.Type), "voice")
}

// buildAnswerJudgeItemsLLM returns items sent to the LLM judge (voice only; choice uses legacy text match).
func buildAnswerJudgeItemsLLM(answers map[string]string, qs []store.Question) []ai.AnswerJudgeItem {
	var items []ai.AnswerJudgeItem
	for _, q := range qs {
		if !isVoiceQuestion(&q) {
			continue
		}
		ca := strings.TrimSpace(q.CorrectAnswer)
		if ca == "" {
			continue
		}
		ua := ""
		if answers != nil {
			ua = strings.TrimSpace(answers[q.ID])
		}
		items = append(items, ai.AnswerJudgeItem{
			ID: q.ID, Type: q.Type, Prompt: q.Prompt, Options: q.Options,
			Correct: ca, UserAnswer: ua,
		})
	}
	return items
}

func countCorrectWithJudgments(qs []store.Question, judge map[string]bool) int {
	n := 0
	for _, q := range qs {
		if strings.TrimSpace(q.CorrectAnswer) == "" {
			continue
		}
		if judge[q.ID] {
			n++
		}
	}
	return n
}

func judgmentsToMap(list []ai.AnswerJudgment) map[string]bool {
	m := make(map[string]bool, len(list))
	for _, j := range list {
		m[j.QuestionID] = j.IsCorrect
	}
	return m
}

func mergeQuestionResults(qs []store.Question, judged []ai.AnswerJudgment, answers map[string]string) []ai.AnswerJudgment {
	byID := make(map[string]ai.AnswerJudgment, len(judged))
	for _, j := range judged {
		byID[j.QuestionID] = j
	}
	out := make([]ai.AnswerJudgment, 0, len(qs))
	for _, q := range qs {
		ca := strings.TrimSpace(q.CorrectAnswer)
		if ca == "" {
			out = append(out, ai.AnswerJudgment{
				QuestionID: q.ID,
				IsCorrect:  false,
				Feedback:   "このもんだいは自動さいていのたいしょう外です。",
			})
			continue
		}
		if j, ok := byID[q.ID]; ok {
			out = append(out, j)
			continue
		}
		ua := ""
		if answers != nil {
			ua = strings.TrimSpace(answers[q.ID])
		}
		out = append(out, legacyAnswerJudgment(&q, ua))
	}
	return out
}

func legacyJudgmentsForExercise(qs []store.Question, answers map[string]string) []ai.AnswerJudgment {
	out := make([]ai.AnswerJudgment, 0, len(qs))
	for _, q := range qs {
		ua := ""
		if answers != nil {
			ua = strings.TrimSpace(answers[q.ID])
		}
		out = append(out, legacyAnswerJudgment(&q, ua))
	}
	return out
}

func legacyAnswerJudgment(q *store.Question, userAnswer string) ai.AnswerJudgment {
	ua := strings.TrimSpace(userAnswer)
	ca := strings.TrimSpace(q.CorrectAnswer)
	if ca == "" {
		return ai.AnswerJudgment{
			QuestionID: q.ID,
			IsCorrect:  false,
			Feedback:   "このもんだいは自動さいていのたいしょう外です。",
		}
	}
	if ua == "" {
		return ai.AnswerJudgment{
			QuestionID: q.ID,
			IsCorrect:  false,
			Feedback:   "こたえをいれてから、かくにんしてね。",
		}
	}
	var match bool
	if strings.EqualFold(q.Type, "voice") {
		match = norm(ua) == norm(plainAnswerForCompare(ca))
	} else {
		// choice: strict text check; correct may include <ruby> from parse pipeline
		pc := plainAnswerForCompare(ca)
		match = norm(ua) == norm(ca) || norm(ua) == norm(pc)
	}
	if match {
		return ai.AnswerJudgment{
			QuestionID: q.ID,
			IsCorrect:  true,
			Feedback:   "せいかい！よくできました。",
		}
	}
	plain := plainAnswerForCompare(ca)
	if len([]rune(plain)) > 100 {
		plain = string([]rune(plain)[:100]) + "…"
	}
	return ai.AnswerJudgment{
		QuestionID: q.ID,
		IsCorrect:  false,
		Feedback:   fmt.Sprintf("ざんねん、まだちがいます。せいかいの例は「%s」です。", plain),
	}
}

func wireQuestionResults(qs []store.Question, answers map[string]string, merged []ai.AnswerJudgment) []map[string]any {
	byID := make(map[string]ai.AnswerJudgment, len(merged))
	for _, j := range merged {
		byID[j.QuestionID] = j
	}
	out := make([]map[string]any, 0, len(qs))
	for _, q := range qs {
		j := byID[q.ID]
		ua := ""
		if answers != nil {
			ua = strings.TrimSpace(answers[q.ID])
		}
		out = append(out, map[string]any{
			"questionId": q.ID,
			"prompt":     q.Prompt,
			"userAnswer": ua,
			"isCorrect":  j.IsCorrect,
			"feedback":   j.Feedback,
		})
	}
	return out
}

const printSummaryPassageMaxRunes = 1200

func truncateRunesPrintSummary(s string, maxRunes int) string {
	s = strings.TrimSpace(s)
	if maxRunes <= 0 || s == "" {
		return s
	}
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	var b strings.Builder
	n := 0
	for _, r := range s {
		if n >= maxRunes {
			break
		}
		b.WriteRune(r)
		n++
	}
	return b.String() + "…"
}

func vocabItemsFromPrintSummary(sum *ai.PrintLearningSummary) []store.VocabItem {
	if sum == nil || len(sum.KeywordCards) == 0 {
		return nil
	}
	overview := strings.TrimSpace(sum.Overview)
	if overview == "" {
		overview = "このプリントのポイントをおさらいしよう。"
	}
	out := make([]store.VocabItem, 0, len(sum.KeywordCards))
	for _, c := range sum.KeywordCards {
		p := strings.TrimSpace(c.Phrase)
		if p == "" {
			continue
		}
		meaning := strings.TrimSpace(c.Nuance)
		if meaning == "" {
			meaning = overview
		}
		out = append(out, store.VocabItem{Word: p, Meaning: meaning})
	}
	return out
}

func (s *Server) buildPrintSummaryPayload(ctx context.Context, g *store.AssignmentGroup) ([]byte, error) {
	var exercises []map[string]any
	for _, e := range g.Exercises {
		if e.Status != "parsed" && e.Status != "completed" {
			continue
		}
		ex, qs, err := s.Store.GetExercise(ctx, e.ID)
		if err != nil {
			continue
		}
		pub := make([]map[string]any, 0, len(qs))
		for _, q := range qs {
			pub = append(pub, map[string]any{
				"type": q.Type, "prompt": q.Prompt, "options": q.Options, "focusWord": q.FocusWord,
			})
		}
		row := map[string]any{
			"dai":             e.AssignmentSort + 1,
			"title":           ex.Title,
			"status":          ex.Status,
			"passage_excerpt": truncateRunesPrintSummary(ex.Passage, printSummaryPassageMaxRunes),
			"questions":       pub,
		}
		if ex.ScorePercent != 0 {
			row["score_percent"] = ex.ScorePercent
		}
		exercises = append(exercises, row)
	}
	if len(exercises) == 0 {
		return nil, fmt.Errorf("no parsed exercises")
	}
	title := strings.TrimSpace(g.Title)
	if title == "" && len(g.Exercises) > 0 {
		title = strings.TrimSpace(g.Exercises[0].Title)
	}
	payload := map[string]any{
		"print_title": title,
		"exercises":   exercises,
	}
	return json.Marshal(payload)
}

func (s *Server) GeneratePrintSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	rt := s.lm()
	if rt.summaryChat == nil {
		s.err(w, http.StatusServiceUnavailable, "まとめの生成には要約用チャット（Gemini または Ollama）が必要です")
		return
	}
	aid := r.PathValue("id")
	if aid == "" {
		s.err(w, http.StatusBadRequest, "プリントIDが不正です")
		return
	}
	g, err := s.Store.GetAssignmentGroup(r.Context(), aid)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			s.err(w, http.StatusNotFound, "見つかりません")
			return
		}
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	payload, err := s.buildPrintSummaryPayload(r.Context(), g)
	if err != nil {
		s.err(w, http.StatusBadRequest, "よみとりずみのもんだいがないとまとめられません")
		return
	}
	sum, err := ai.SummarizePrint(r.Context(), rt.summaryChat, rt.summaryModel, string(payload))
	if err != nil {
		log.Printf("print_summary: %v", err)
		s.err(w, http.StatusBadGateway, "まとめの生成に失敗: "+err.Error())
		return
	}
	raw, err := json.Marshal(sum)
	if err != nil {
		s.err(w, http.StatusInternalServerError, "encode")
		return
	}
	if err := s.Store.SavePrintSummary(r.Context(), aid, string(raw)); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(g.Exercises) > 0 {
		anchor := g.Exercises[0].ID
		items := vocabItemsFromPrintSummary(sum)
		if err := s.Store.ReplaceVocabCardsForAssignment(r.Context(), aid, anchor, items); err != nil {
			log.Printf("print_summary vocab: %v", err)
		}
	}
	s.json(w, http.StatusOK, map[string]any{"summary": sum})
}

func (s *Server) GetPrintSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.err(w, http.StatusMethodNotAllowed, "GET のみ")
		return
	}
	aid := r.PathValue("id")
	if aid == "" {
		s.err(w, http.StatusBadRequest, "プリントIDが不正です")
		return
	}
	j, err := s.Store.GetPrintSummary(r.Context(), aid)
	if err != nil || j == "" {
		s.err(w, http.StatusNotFound, "まだありません")
		return
	}
	var sum ai.PrintLearningSummary
	if err := json.Unmarshal([]byte(j), &sum); err != nil {
		s.err(w, http.StatusInternalServerError, "まとめの形式が壊れています")
		return
	}
	ai.NormalizePrintLearningSummary(&sum)
	out, err := json.Marshal(sum)
	if err != nil {
		s.err(w, http.StatusInternalServerError, "encode")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(out)
}

func (s *Server) History(w http.ResponseWriter, r *http.Request) {
	groups, err := s.Store.ListAssignmentsForHistory(r.Context(), 80)
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{"assignments": groups})
}

func (s *Server) MonthlyReminder(w http.ResponseWriter, r *http.Request) {
	cards, err := s.Store.MonthlyVocab(r.Context(), 40)
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(cards) == 0 {
		cards, _ = s.Store.AllVocabForReview(r.Context(), 30)
	}
	s.json(w, http.StatusOK, map[string]any{"cards": cards})
}

func (s *Server) ReviewCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "IDが必要です")
		return
	}
	if err := s.Store.TouchVocabReview(r.Context(), id); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", s.Health)
	mux.HandleFunc("GET /api/settings", s.GetSettings)
	mux.HandleFunc("GET /api/settings/ollama-check", s.GetOllamaCheck)
	mux.HandleFunc("PUT /api/settings", s.PutSettings)
	mux.HandleFunc("POST /api/settings", s.PutSettings)
	mux.HandleFunc("POST /api/transcribe", s.TranscribeAudio)
	mux.HandleFunc("POST /api/upload", s.UploadScan)
	mux.HandleFunc("GET /api/prints/{id}", s.GetPrint)
	mux.HandleFunc("PATCH /api/prints/{id}", s.PatchPrint)
	mux.HandleFunc("POST /api/prints/{id}/ensure-scan-draft", s.EnsureScanDraft)
	mux.HandleFunc("POST /api/prints", s.CreatePrint)
	mux.HandleFunc("POST /api/exercises/{id}/pages", s.AddExercisePage)
	mux.HandleFunc("DELETE /api/exercises/{id}/pages/{pageIndex}", s.DeleteExercisePage)
	mux.HandleFunc("POST /api/exercises/{id}/parse", s.ParseExercise)
	mux.HandleFunc("GET /api/exercises/{id}/image/{pageIndex}", s.ExerciseImagePage)
	mux.HandleFunc("GET /api/exercises/{id}/image", s.ExerciseImage)
	mux.HandleFunc("DELETE /api/exercises/{id}", s.DeleteExercise)
	mux.HandleFunc("GET /api/exercises/{id}", s.GetExercise)
	mux.HandleFunc("POST /api/exercises/{id}/submit", s.SubmitAnswers)
	mux.HandleFunc("POST /api/exercises/{id}/questions/{questionId}/check", s.CheckQuestion)
	mux.HandleFunc("GET /api/exercises/{id}/questions/{questionId}/solution", s.GetQuestionSolution)
	mux.HandleFunc("POST /api/prints/{id}/summary", s.GeneratePrintSummary)
	mux.HandleFunc("GET /api/prints/{id}/summary", s.GetPrintSummary)
	mux.HandleFunc("GET /api/history", s.History)
	mux.HandleFunc("GET /api/reminders/monthly", s.MonthlyReminder)
	mux.HandleFunc("POST /api/vocab/{id}/review", s.ReviewCard)
}
