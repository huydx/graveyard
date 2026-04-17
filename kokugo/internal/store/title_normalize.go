package store

import (
	"regexp"
	"strings"
)

var multiSpaceRE = regexp.MustCompile(`\s+`)

// NormalizeExerciseTitle fixes common OCR / layout glitches in parsed 大問 titles.
func NormalizeExerciseTitle(title string) string {
	t := strings.TrimSpace(title)
	if t == "" {
		return t
	}
	// Hiragana confusion: ち vs さ in 友だち
	t = strings.ReplaceAll(t, "おともださ", "おともだち")
	t = strings.ReplaceAll(t, "お友ださ", "お友だち")
	// Katakana misread + stray kanji from adjacent column (早稲田系プリントで多い)
	t = strings.ReplaceAll(t, "ナリマ小", "なります")
	t = multiSpaceRE.ReplaceAllString(t, " ")
	return strings.TrimSpace(t)
}
