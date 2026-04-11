package ai

import (
	"testing"
)

func TestParseKotsuPagesFromStorageJSON_envelope(t *testing.T) {
	j := `{"pages":[{"main_idea":"a","pattern":"b","care_points":["c"],"visualization_html":"<p>x</p>"}]}`
	pages, err := ParseKotsuPagesFromStorageJSON(j)
	if err != nil || len(pages) != 1 || pages[0].MainIdea != "a" {
		t.Fatalf("got %+v err=%v", pages, err)
	}
}

func TestParseKotsuPagesFromStorageJSON_legacySingle(t *testing.T) {
	j := `{"main_idea":"a","pattern":"b","care_points":["c"],"visualization_html":"<p>x</p>"}`
	pages, err := ParseKotsuPagesFromStorageJSON(j)
	if err != nil || len(pages) != 1 || pages[0].Pattern != "b" {
		t.Fatalf("got %+v err=%v", pages, err)
	}
}

func TestParseKotsuPagesFromStorageJSON_emptyPagesArray(t *testing.T) {
	pages, err := ParseKotsuPagesFromStorageJSON(`{"pages":[]}`)
	if err != nil || len(pages) != 0 {
		t.Fatalf("got %+v err=%v", pages, err)
	}
}

func TestMarshalKotsuPagesJSON_roundTrip(t *testing.T) {
	in := []MathExerciseKotsuSummary{
		{MainIdea: "m", Pattern: "p", CarePoints: []string{"c"}, VisualizationHTML: "<div/>"},
	}
	s, err := MarshalKotsuPagesJSON(in)
	if err != nil {
		t.Fatal(err)
	}
	out, err := ParseKotsuPagesFromStorageJSON(s)
	if err != nil || len(out) != 1 || out[0].MainIdea != "m" {
		t.Fatalf("got %+v err=%v", out, err)
	}
}
