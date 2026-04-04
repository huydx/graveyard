package ollama

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListLocalModelNames(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tags" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"models":[{"name":"m1"},{"name":"m2"},{"name":"m1"}]}`))
	}))
	defer srv.Close()

	names, err := ListLocalModelNames(context.Background(), srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	if len(names) != 2 || names[0] != "m1" || names[1] != "m2" {
		t.Fatalf("got %v", names)
	}
}
