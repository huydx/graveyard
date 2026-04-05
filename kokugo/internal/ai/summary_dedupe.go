package ai

import (
	"strings"

	"github.com/huydx/kokugo/internal/textnorm"
)

const printSummaryMaxKeywords = 10

// NormalizePrintLearningSummary trims overview, dedupes keyword cards by phrase, and caps at printSummaryMaxKeywords.
func NormalizePrintLearningSummary(s *PrintLearningSummary) {
	if s == nil {
		return
	}
	s.Overview = strings.TrimSpace(s.Overview)
	s.KeywordCards = dedupeKeywordCards(s.KeywordCards)
	if len(s.KeywordCards) > printSummaryMaxKeywords {
		s.KeywordCards = s.KeywordCards[:printSummaryMaxKeywords]
	}
}

func dedupeKeywordCards(in []PrintKeywordCard) []PrintKeywordCard {
	seen := make(map[string]struct{}, len(in))
	out := make([]PrintKeywordCard, 0, len(in))
	for _, c := range in {
		p := strings.TrimSpace(c.Phrase)
		n := strings.TrimSpace(c.Nuance)
		if p == "" {
			continue
		}
		key := textnorm.PlainForDedupe(p)
		if key == "" {
			key = p
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, PrintKeywordCard{Phrase: p, Nuance: n})
	}
	return out
}

// DedupeLearningSummary removes duplicate key points and vocabulary entries (by comparable text / word+reading).
// Example strings within each vocabulary item are deduplicated. s must be non-nil.
func DedupeLearningSummary(s *LearningSummary) {
	if s == nil {
		return
	}
	s.KeyPoints = dedupeKeyPoints(s.KeyPoints)
	s.Vocabulary = dedupeVocabSummaries(s.Vocabulary)
}

func dedupeKeyPoints(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, k := range in {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		n := textnorm.PlainForDedupe(k)
		if n == "" {
			n = k
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, k)
	}
	return out
}

func dedupeVocabSummaries(in []VocabSummary) []VocabSummary {
	seen := make(map[string]struct{}, len(in))
	out := make([]VocabSummary, 0, len(in))
	for _, v := range in {
		r := strings.TrimSpace(v.Reading)
		surf := textnorm.PlainForDedupe(v.Word)
		if surf == "" && r == "" {
			continue
		}
		key := surf + "\x00" + r
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		v.Examples = dedupeExampleStrings(v.Examples)
		out = append(out, v)
	}
	return out
}

func dedupeExampleStrings(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, e := range in {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		n := textnorm.PlainForDedupe(e)
		if n == "" {
			n = e
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, e)
	}
	return out
}
