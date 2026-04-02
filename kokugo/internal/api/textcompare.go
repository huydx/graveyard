package api

import (
	"regexp"
	"strings"
)

var (
	reRubyBlock = regexp.MustCompile(`(?i)<ruby[^>]*>[\s\S]*?<rt[^>]*>([\s\S]*?)</rt>[\s\S]*?</ruby>`)
	reAnyTag    = regexp.MustCompile(`<[^>]+>`)
)

// plainAnswerForCompare turns ruby HTML into the reading (rt) where present, then strips tags.
// Used so voice answers (plain hiragana) can match correct fields that include furigana markup.
func plainAnswerForCompare(s string) string {
	out := s
	for reRubyBlock.MatchString(out) {
		out = reRubyBlock.ReplaceAllString(out, "$1")
	}
	out = reAnyTag.ReplaceAllString(out, "")
	return strings.TrimSpace(out)
}
