package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/huydx/kokugo/internal/config"
	"github.com/huydx/kokugo/internal/gemini"
	"github.com/huydx/kokugo/internal/store"
)

const maxExercisePages = 12

type Server struct {
	Cfg    config.Config
	Store  *store.Store
	Gemini *gemini.Client
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
	s.json(w, http.StatusOK, map[string]any{
		"geminiConnected":    s.Gemini != nil,
		"speechTranscribeOK": s.Gemini != nil,
		"childName":          s.Cfg.ChildName,
	})
}

func (s *Server) TranscribeAudio(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	if s.Gemini == nil {
		s.err(w, http.StatusServiceUnavailable, "Gemini が未設定です")
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
	text, err := s.Gemini.TranscribeAnswerAudio(r.Context(), data, mime)
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

func randomName() string {
	return strconv.FormatInt(time.Now().UnixNano(), 36)
}

func (s *Server) ParseExercise(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	if s.Gemini == nil {
		s.err(w, http.StatusServiceUnavailable, "Gemini が未設定です（GOOGLE_API_KEY）")
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
	var pages []gemini.ImagePart
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			s.err(w, http.StatusInternalServerError, "画像ファイルを読めません")
			return
		}
		pages = append(pages, gemini.ImagePart{Data: data, MIME: mimeForPath(p)})
	}
	var parsed *gemini.ParsedExercise
	if len(pages) == 1 {
		parsed, err = s.Gemini.ParseExerciseImage(r.Context(), pages[0].Data, pages[0].MIME)
	} else {
		parsed, err = s.Gemini.ParseExercisePages(r.Context(), pages)
	}
	if err != nil {
		log.Printf("parse: %v", err)
		s.err(w, http.StatusBadGateway, "AIの解析に失敗しました: "+err.Error())
		return
	}
	if err := s.Store.SetExerciseParsed(r.Context(), id, parsed.Title, parsed.Passage); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	var qs []store.Question
	for _, q := range parsed.Questions {
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
	if err := s.Store.ReplaceQuestions(r.Context(), id, qs); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true, "title": parsed.Title, "questionCount": len(qs)})
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
		})
	}
	s.json(w, http.StatusOK, map[string]any{"exercise": ex, "questions": pub})
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
	_, qs, err := s.Store.GetExercise(r.Context(), id)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	correct := 0
	for _, q := range qs {
		ua := strings.TrimSpace(body.Answers[q.ID])
		ca := strings.TrimSpace(q.CorrectAnswer)
		if ca == "" {
			continue
		}
		match := false
		if strings.EqualFold(q.Type, "voice") {
			match = norm(ua) == norm(plainAnswerForCompare(ca))
		} else {
			match = norm(ua) == norm(ca)
		}
		if match {
			correct++
		}
	}
	pct := 0
	if len(qs) > 0 {
		pct = (correct * 100) / len(qs)
	}
	if err := s.Store.SaveAnswersAndComplete(r.Context(), id, body.Answers, pct); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{
		"scorePercent": pct,
		"correct":      correct,
		"total":        len(qs),
	})
}

func norm(s string) string {
	return strings.TrimSpace(strings.ToLower(s))
}

func (s *Server) GenerateSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	if s.Gemini == nil {
		s.err(w, http.StatusServiceUnavailable, "Gemini が未設定です")
		return
	}
	eid := r.PathValue("id")
	if eid == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	ex, qs, err := s.Store.GetExercise(r.Context(), eid)
	if err != nil {
		s.err(w, http.StatusNotFound, "見つかりません")
		return
	}
	qj, _ := json.Marshal(qs)
	sum, err := s.Gemini.SummarizeLearning(r.Context(), ex.Title, ex.Passage, string(qj), ex.ScorePercent)
	if err != nil {
		log.Printf("summary: %v", err)
		s.err(w, http.StatusBadGateway, "まとめの生成に失敗: "+err.Error())
		return
	}
	raw, err := json.Marshal(sum)
	if err != nil {
		s.err(w, http.StatusInternalServerError, "encode")
		return
	}
	if err := s.Store.SaveSummary(r.Context(), eid, string(raw)); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	var items []store.VocabItem
	for _, v := range sum.Vocabulary {
		items = append(items, store.VocabItem{
			Word: v.Word, Reading: v.Reading, Meaning: v.Meaning, Examples: v.Examples,
		})
	}
	if err := s.Store.InsertVocabCards(r.Context(), eid, items); err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{"summary": sum})
}

func (s *Server) GetSummary(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		s.err(w, http.StatusBadRequest, "演習IDが不正です")
		return
	}
	j, err := s.Store.GetSummary(r.Context(), id)
	if err != nil || j == "" {
		s.err(w, http.StatusNotFound, "まだありません")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(j))
}

func (s *Server) History(w http.ResponseWriter, r *http.Request) {
	list, err := s.Store.ListExercises(r.Context(), 80)
	if err != nil {
		s.err(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.json(w, http.StatusOK, map[string]any{"exercises": list})
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
	mux.HandleFunc("POST /api/transcribe", s.TranscribeAudio)
	mux.HandleFunc("POST /api/upload", s.UploadScan)
	mux.HandleFunc("POST /api/exercises/{id}/pages", s.AddExercisePage)
	mux.HandleFunc("POST /api/exercises/{id}/parse", s.ParseExercise)
	mux.HandleFunc("GET /api/exercises/{id}/image/{pageIndex}", s.ExerciseImagePage)
	mux.HandleFunc("GET /api/exercises/{id}/image", s.ExerciseImage)
	mux.HandleFunc("GET /api/exercises/{id}", s.GetExercise)
	mux.HandleFunc("POST /api/exercises/{id}/submit", s.SubmitAnswers)
	mux.HandleFunc("POST /api/exercises/{id}/summary", s.GenerateSummary)
	mux.HandleFunc("GET /api/exercises/{id}/summary", s.GetSummary)
	mux.HandleFunc("GET /api/history", s.History)
	mux.HandleFunc("GET /api/reminders/monthly", s.MonthlyReminder)
	mux.HandleFunc("POST /api/vocab/{id}/review", s.ReviewCard)
}
