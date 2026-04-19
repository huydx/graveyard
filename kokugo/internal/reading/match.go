package reading

import (
	"regexp"
	"strings"
	"unicode"

	normunicode "golang.org/x/text/unicode/norm"
)

var htmlTagStripRe = regexp.MustCompile(`<[^>]+>`)
var rtBlockRe = regexp.MustCompile(`(?is)<rt[^>]*>.*?</rt>`)
var rpBlockRe = regexp.MustCompile(`(?is)<rp[^>]*>.*?</rp>`)

// StripHTMLToPlain removes HTML tags from s.
func StripHTMLToPlain(s string) string {
	return strings.TrimSpace(htmlTagStripRe.ReplaceAllString(s, ""))
}

// PassagePlainForMatch approximates visible reading text: drop furigana (rt/rp) then strip remaining tags.
func PassagePlainForMatch(html string) string {
	s := rtBlockRe.ReplaceAllString(html, "")
	s = rpBlockRe.ReplaceAllString(s, "")
	return StripHTMLToPlain(s)
}

// CompactPassageMatch normalizes for substring checks (NFC, drop ZW/spaces).
func CompactPassageMatch(s string) string {
	s = normunicode.NFC.String(s)
	var b strings.Builder
	for _, r := range s {
		switch r {
		case '\u200b', '\u200c', '\u200d', '\ufeff', '\u2060':
			continue
		}
		if r >= 0xfe00 && r <= 0xfe0f {
			continue
		}
		if !unicode.IsSpace(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func substringLikelyInPassage(sel, pass string) bool {
	if sel == "" {
		return false
	}
	if len(sel) > len(pass) {
		return false
	}
	return strings.Contains(pass, sel)
}

// SelectionLikelyFromPassage checks that the user's highlight appears inside the passage HTML.
func SelectionLikelyFromPassage(selection, passageHTML string) bool {
	sel := CompactPassageMatch(strings.TrimSpace(selection))
	if sel == "" {
		return false
	}
	passVisible := CompactPassageMatch(PassagePlainForMatch(passageHTML))
	passWithReadings := CompactPassageMatch(StripHTMLToPlain(passageHTML))
	return substringLikelyInPassage(sel, passVisible) || substringLikelyInPassage(sel, passWithReadings)
}
