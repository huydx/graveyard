package paddleocr

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/huydx/kokugo/internal/ai"
)

func TestClientExtractText_multipartFile(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/ocr" || r.Method != http.MethodPost {
			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
		}
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			t.Fatal(err)
		}
		f, hdr, err := r.FormFile("file")
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		if hdr.Filename == "" {
			t.Fatal("expected filename")
		}
		b, err := io.ReadAll(f)
		if err != nil {
			t.Fatal(err)
		}
		if len(b) != 3 {
			t.Fatalf("expected 3 bytes, got %d", len(b))
		}
		_ = json.NewEncoder(w).Encode(ocrResponse{Text: "hello\nworld"})
	}))
	defer srv.Close()

	c := NewClient(srv.URL, srv.Client())
	got, err := c.ExtractText(context.Background(), ai.ImagePart{Data: []byte{1, 2, 3}, MIME: "image/png"})
	if err != nil {
		t.Fatal(err)
	}
	if got != "hello\nworld" {
		t.Fatalf("got %q", got)
	}
}

func TestClientExtractText_fallsBackToBlocks(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseMultipartForm(8 << 20)
		_ = json.NewEncoder(w).Encode(ocrResponse{
			Blocks: []textBlock{{Content: "a"}, {Content: "b"}},
		})
	}))
	defer srv.Close()

	c := NewClient(srv.URL, srv.Client())
	got, err := c.ExtractText(context.Background(), ai.ImagePart{Data: []byte("x")})
	if err != nil {
		t.Fatal(err)
	}
	if got != "a\nb" {
		t.Fatalf("got %q", got)
	}
}

func TestClientExtractText_apiError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(errBody{Error: "bad image"})
	}))
	defer srv.Close()

	c := NewClient(srv.URL, srv.Client())
	_, err := c.ExtractText(context.Background(), ai.ImagePart{Data: []byte("x")})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "bad image") {
		t.Fatalf("got %v", err)
	}
}

func TestFormatAPIError_fastAPIDetail(t *testing.T) {
	raw := []byte(`{"detail":[{"type":"missing","loc":["body","file"],"msg":"Field required"}]}`)
	got := formatAPIError(raw, "422")
	if !strings.Contains(got, "Field required") || !strings.Contains(got, "file") {
		t.Fatalf("got %q", got)
	}
}
