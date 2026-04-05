package ai

import (
	"encoding/json"
	"testing"
)

func TestNormalizePrintLearningSummary(t *testing.T) {
	s := &PrintLearningSummary{
		Overview: "  全体の流れ  ",
		KeywordCards: []PrintKeywordCard{
			{Phrase: "  語句A  ", Nuance: "説明A"},
			{Phrase: "語句A", Nuance: "dup"},
			{Phrase: "語句B", Nuance: "b"},
			{Phrase: "c", Nuance: ""},
			{Phrase: "d", Nuance: ""},
			{Phrase: "e", Nuance: ""},
			{Phrase: "f", Nuance: ""},
			{Phrase: "g", Nuance: ""},
			{Phrase: "h", Nuance: ""},
			{Phrase: "i", Nuance: ""},
			{Phrase: "j", Nuance: ""},
			{Phrase: "k", Nuance: ""},
		},
	}
	NormalizePrintLearningSummary(s)
	if s.Overview != "全体の流れ" {
		t.Fatalf("overview = %q", s.Overview)
	}
	if len(s.KeywordCards) != 10 {
		t.Fatalf("cards len = %d; want 10: %#v", len(s.KeywordCards), s.KeywordCards)
	}
	if s.KeywordCards[0].Phrase != "語句A" || s.KeywordCards[0].Nuance != "説明A" {
		t.Fatalf("first card = %#v", s.KeywordCards[0])
	}
}

func TestPrintLearningSummaryUnmarshalLegacyKeywordsNuances(t *testing.T) {
	raw := `{"overview":"まとめ","keywords_nuances":[" あ ","あ","び"]}`
	var s PrintLearningSummary
	if err := json.Unmarshal([]byte(raw), &s); err != nil {
		t.Fatal(err)
	}
	if len(s.KeywordCards) != 3 {
		t.Fatalf("unmarshal cards = %#v", s.KeywordCards)
	}
	NormalizePrintLearningSummary(&s)
	if len(s.KeywordCards) != 2 {
		t.Fatalf("after normalize want 2, got %#v", s.KeywordCards)
	}
	if s.KeywordCards[0].Phrase != "あ" || s.KeywordCards[1].Phrase != "び" {
		t.Fatalf("phrases = %#v", s.KeywordCards)
	}
}
