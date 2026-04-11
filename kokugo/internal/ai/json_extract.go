package ai

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

// ExtractFirstJSONObject returns the substring from the first balanced top-level `{` … `}`,
// respecting JSON string literals and escapes. Use when models append text after valid JSON.
func ExtractFirstJSONObject(s string) (string, error) {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "\ufeff")
	start := strings.IndexByte(s, '{')
	if start < 0 {
		return "", fmt.Errorf("no JSON object start")
	}
	depth := 0
	inStr := false
	escape := false
	for i := start; i < len(s); {
		r, size := utf8.DecodeRuneInString(s[i:])
		if size == 0 {
			break
		}
		if inStr {
			if escape {
				escape = false
			} else if r == '\\' {
				escape = true
			} else if r == '"' {
				inStr = false
			}
		} else {
			switch r {
			case '"':
				inStr = true
			case '{':
				depth++
			case '}':
				depth--
				if depth == 0 {
					return s[start : i+size], nil
				}
			}
		}
		i += size
	}
	return "", fmt.Errorf("unclosed JSON object")
}
