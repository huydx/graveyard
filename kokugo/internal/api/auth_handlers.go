package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/huydx/kokugo/internal/store"
)

const sessionCookieName = "kokugo_session"

func readSessionCookie(r *http.Request) string {
	c, err := r.Cookie(sessionCookieName)
	if err != nil || c == nil {
		return ""
	}
	return strings.TrimSpace(c.Value)
}

func setSessionCookie(w http.ResponseWriter, token string, maxAgeSec int) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAgeSec,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login POST sets a session cookie (no registration).
func (s *Server) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	var body loginBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, http.StatusBadRequest, "JSONが不正です")
		return
	}
	email := strings.TrimSpace(strings.ToLower(body.Email))
	if email == "" || strings.TrimSpace(body.Password) == "" {
		s.err(w, http.StatusBadRequest, "メールとパスワードが必要です")
		return
	}
	u, err := s.Store.GetUserByEmail(r.Context(), email)
	if err != nil {
		s.err(w, http.StatusUnauthorized, "メールかパスワードがちがいます")
		return
	}
	if !store.CheckPassword(u.PasswordHash, body.Password) {
		s.err(w, http.StatusUnauthorized, "メールかパスワードがちがいます")
		return
	}
	tok, err := s.Store.CreateSession(r.Context(), u.ID)
	if err != nil {
		log.Printf("login session: %v", err)
		s.err(w, http.StatusInternalServerError, "セッションを作れませんでした")
		return
	}
	setSessionCookie(w, tok, 30*24*3600)
	if err := s.reloadLLMForUser(r.Context(), u.ID); err != nil {
		log.Printf("login warm llm: %v", err)
	}
	s.json(w, http.StatusOK, map[string]any{"ok": true, "email": u.Email})
}

// Logout POST clears the session cookie and server-side session row (works even if session expired).
func (s *Server) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.err(w, http.StatusMethodNotAllowed, "POST のみ")
		return
	}
	tok := readSessionCookie(r)
	if tok != "" {
		uid, _ := s.Store.SessionUserID(r.Context(), tok)
		if uid != "" {
			s.invalidateLLMUser(uid)
		}
		_ = s.Store.DeleteSession(r.Context(), tok)
	}
	clearSessionCookie(w)
	s.json(w, http.StatusOK, map[string]bool{"ok": true})
}

// AuthMe GET returns the current user's email.
func (s *Server) AuthMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.err(w, http.StatusMethodNotAllowed, "GET のみ")
		return
	}
	uid := UserIDFromCtx(r.Context())
	u, err := s.Store.GetUserByID(r.Context(), uid)
	if err != nil {
		s.err(w, http.StatusUnauthorized, "ログインが必要です")
		return
	}
	s.json(w, http.StatusOK, map[string]string{"email": u.Email})
}

func (s *Server) withAuth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tok := readSessionCookie(r)
		uid, err := s.Store.SessionUserID(r.Context(), tok)
		if err != nil {
			s.err(w, http.StatusUnauthorized, "ログインが必要です")
			return
		}
		h(w, r.WithContext(WithUserID(r.Context(), uid)))
	}
}

func (s *Server) optionalUserID(r *http.Request) string {
	tok := readSessionCookie(r)
	if tok == "" {
		return ""
	}
	uid, err := s.Store.SessionUserID(r.Context(), tok)
	if err != nil {
		return ""
	}
	return uid
}
