package ollama

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const tagsTimeout = 8 * time.Second

type tagsResponse struct {
	Models []struct {
		Name string `json:"name"`
	} `json:"models"`
}

// ListLocalModelNames returns model names from GET {baseURL}/api/tags.
func ListLocalModelNames(ctx context.Context, baseURL string) ([]string, error) {
	base := strings.TrimSpace(baseURL)
	if base == "" {
		return nil, fmt.Errorf("ollama: base URL is empty")
	}
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("ollama: invalid base URL")
	}
	tagsURL := strings.TrimRight(u.String(), "/") + "/api/tags"

	cctx, cancel := context.WithTimeout(ctx, tagsTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(cctx, http.MethodGet, tagsURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("ollama: read body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama: tags http %d: %s", resp.StatusCode, truncateStr(string(body), 200))
	}
	var tr tagsResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return nil, fmt.Errorf("ollama: tags json: %w", err)
	}
	out := make([]string, 0, len(tr.Models))
	seen := map[string]struct{}{}
	for _, m := range tr.Models {
		n := strings.TrimSpace(m.Name)
		if n == "" {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	return out, nil
}
