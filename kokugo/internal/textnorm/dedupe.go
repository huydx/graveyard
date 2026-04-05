package textnorm

import (
	"regexp"
	"strings"
)

var (
	reRubyWithRT = regexp.MustCompile(`(?i)<ruby[^>]*>([\s\S]*?)<rt[^>]*>[\s\S]*?</rt>[\s\S]*?</ruby>`)
	reAnyTag     = regexp.MustCompile(`<[^>]+>`)
)

// PlainForDedupe reduces HTML+furigana strings to comparable plain text for deduplication.
// Each <ruby>…<rt>…</rt>…</ruby> block becomes its base text (before <rt>); remaining tags are stripped.
func PlainForDedupe(s string) string {
	out := strings.TrimSpace(s)
	out = reRubyWithRT.ReplaceAllString(out, "$1")
	out = reAnyTag.ReplaceAllString(out, "")
	return strings.Join(strings.Fields(out), "")
}
