package main

import (
	"io/fs"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/huydx/kokugo/internal/api"
	"github.com/huydx/kokugo/internal/config"
	"github.com/huydx/kokugo/internal/store"
	"github.com/huydx/kokugo/web"
)

func main() {
	cfg := config.Load()
	st, err := store.Open(cfg.DBPath)
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()

	srv := &api.Server{Cfg: cfg, Store: st}

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	staticFS, err := fs.Sub(web.Static, "static")
	if err != nil {
		log.Fatal(err)
	}
	mux.Handle("GET /assets/", http.StripPrefix("/", http.FileServer(http.FS(staticFS))))

	// PWA: manifest, service worker, registerSW.js, workbox-*.js, icons (single path segment).
	mux.HandleFunc("GET /{name}", serveStaticRootFile)

	spaPaths := []string{
		"GET /",
		"GET /scan",
		"GET /history",
		"GET /remind",
		"GET /settings",
		"GET /exercise/{id}",
		"GET /result/{id}",
		"GET /prints",
		"GET /prints/{path...}",
		"GET /kokugo",
		"GET /kokugo/login",
		"GET /kokugo/{path...}",
		"GET /sansu",
		"GET /sansu/{path...}",
	}
	for _, p := range spaPaths {
		mux.HandleFunc(p, serveSPA)
	}

	addr := cfg.ListenAddr
	if strings.HasPrefix(addr, ":") {
		log.Printf("listening http://127.0.0.1%s", addr)
	} else {
		log.Printf("listening %s", addr)
	}
	log.Fatal(http.ListenAndServe(addr, mux))
}

func serveSPA(w http.ResponseWriter, r *http.Request) {
	data, err := web.Static.ReadFile("static/index.html")
	if err != nil {
		http.Error(w, "index.html not found — run npm run build in web/ui", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

func serveStaticRootFile(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" || strings.Contains(name, "/") || filepath.Base(name) != name || strings.Contains(name, "..") {
		http.NotFound(w, r)
		return
	}
	rel := "static/" + name
	data, err := web.Static.ReadFile(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	switch filepath.Ext(name) {
	case ".webmanifest":
		w.Header().Set("Content-Type", "application/manifest+json; charset=utf-8")
	default:
		if ct := mime.TypeByExtension(filepath.Ext(name)); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
	}
	_, _ = w.Write(data)
}
