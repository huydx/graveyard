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
