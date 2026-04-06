package main

import (
	"context"
	"io/fs"
	"log"
	"net/http"
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
	if err := srv.ReloadLLM(context.Background()); err != nil {
		log.Fatalf("ReloadLLM: %v", err)
	}

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	staticFS, err := fs.Sub(web.Static, "static")
	if err != nil {
		log.Fatal(err)
	}
	mux.Handle("GET /assets/", http.StripPrefix("/", http.FileServer(http.FS(staticFS))))

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
