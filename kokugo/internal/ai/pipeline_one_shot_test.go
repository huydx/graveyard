package ai

import "testing"

func TestDecodeParsedPageJSON_bundle(t *testing.T) {
	raw := `{"exercises":[{"title":"A","passage":"p","questions":[{"type":"voice","prompt":"q","options":[],"correct":"","focus_word":""}]}]}`
	list, err := decodeParsedPageJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Title != "A" {
		t.Fatalf("got %+v", list)
	}
}

func TestDecodeParsedPageJSON_legacySingle(t *testing.T) {
	raw := `{"title":"B","passage":"x","questions":[{"type":"voice","prompt":"q","options":[],"correct":"","focus_word":""}]}`
	list, err := decodeParsedPageJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Title != "B" {
		t.Fatalf("got %+v", list)
	}
}

func TestConcatParsedPages_order(t *testing.T) {
	a := ParsedExercise{Title: "1", Questions: []ParsedQuestion{{Prompt: "a"}}}
	b := ParsedExercise{Title: "2", Questions: []ParsedQuestion{{Prompt: "b"}}}
	c := ParsedExercise{Title: "3", Questions: []ParsedQuestion{{Prompt: "c"}}}
	out := concatParsedPages([][]ParsedExercise{{a, b}, {c}})
	if len(out) != 3 || out[0].Title != "1" || out[2].Title != "3" {
		t.Fatalf("got %+v", out)
	}
}

func TestMergeParsedExercisesFromMultiPageScan_dedupesTitleJoinsPassageAndQuestions(t *testing.T) {
	got := mergeParsedExercisesFromMultiPageScan([]ParsedExercise{
		{Title: "読解", Passage: "ああ", Questions: []ParsedQuestion{{Prompt: "q1"}}},
		{Title: "読解", Passage: "いい", Questions: []ParsedQuestion{{Prompt: "q2"}}},
		{Title: "文法", Passage: "うう", Questions: []ParsedQuestion{{Prompt: "q3"}}},
	})
	if got.Title != "読解 · 文法" {
		t.Fatalf("title: %q", got.Title)
	}
	if want := "ああ\n\nいい\n\nうう"; got.Passage != want {
		t.Fatalf("passage: %q want %q", got.Passage, want)
	}
	if len(got.Questions) != 3 || got.Questions[0].Prompt != "q1" || got.Questions[2].Prompt != "q3" {
		t.Fatalf("questions: %+v", got.Questions)
	}
}

func TestMergeParsedExercisesFromMultiPageScan_singleIsNoop(t *testing.T) {
	one := ParsedExercise{Title: "only", Passage: "p", Questions: []ParsedQuestion{{Prompt: "x"}}}
	got := mergeParsedExercisesFromMultiPageScan([]ParsedExercise{one})
	if got.Title != one.Title || got.Passage != one.Passage || len(got.Questions) != 1 {
		t.Fatalf("got %+v", got)
	}
}
