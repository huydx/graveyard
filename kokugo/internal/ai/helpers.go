package ai

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

func StripMarkdownFence(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s
	}
	s = strings.TrimPrefix(s, "```")
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		head := strings.TrimSpace(s[:i])
		if head != "" && head[0] != '{' {
			s = s[i+1:]
		}
	}
	if last := strings.LastIndex(s, "```"); last >= 0 {
		s = s[:last]
	}
	return strings.TrimSpace(s)
}

func LogPreview(s string) string {
	max := logPreviewMax()
	if len(s) <= max {
		return s
	}
	return s[:max] + fmt.Sprintf("…(%d chars total)", len(s))
}

func logPreviewMax() int {
	if v := os.Getenv("KOKUGO_PARSE_LOG_MAX"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return 2000
}

func Truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
