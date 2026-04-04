package ai

import "testing"

func TestParseJudgeResultsJSON_strict(t *testing.T) {
	text := `{"results":[{"question_id":"q1","is_correct":true,"feedback":"OK"}]}`
	rows, err := parseJudgeResultsJSON(text)
	if err != nil || len(rows) != 1 || rows[0].QuestionID != "q1" || !rows[0].IsCorrect {
		t.Fatalf("got %+v err=%v", rows, err)
	}
}

func TestParseJudgeResultsJSON_alternateKeyResult(t *testing.T) {
	text := `{"result":[{"question_id":"a","is_correct":false,"feedback":"no"}]}`
	rows, err := parseJudgeResultsJSON(text)
	if err != nil || len(rows) != 1 || rows[0].QuestionID != "a" || rows[0].IsCorrect {
		t.Fatalf("got %+v err=%v", rows, err)
	}
}

func TestParseJudgeResultsJSON_camelCaseRootArray(t *testing.T) {
	text := `[{"id":"x","isCorrect":true,"comment":"nice"}]`
	rows, err := parseJudgeResultsJSON(text)
	if err != nil || len(rows) != 1 || rows[0].QuestionID != "x" || !rows[0].IsCorrect || rows[0].Feedback != "nice" {
		t.Fatalf("got %+v err=%v", rows, err)
	}
}

func TestParseJudgeResultsJSON_wrappedProse(t *testing.T) {
	text := `Here you go: {"results":[{"question_id":"p","is_correct":true,"feedback":"y"}]} thanks`
	rows, err := parseJudgeResultsJSON(text)
	if err != nil || len(rows) != 1 || rows[0].QuestionID != "p" {
		t.Fatalf("got %+v err=%v", rows, err)
	}
}

func TestParseJudgeResultsJSON_emptyResultsErrors(t *testing.T) {
	_, err := parseJudgeResultsJSON(`{"results":[]}`)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestParseJudgeResultsJSON_singleObjectNoArray(t *testing.T) {
	text := `{"question_id":"solo","is_correct":true,"feedback":"単体"}`
	rows, err := parseJudgeResultsJSON(text)
	if err != nil || len(rows) != 1 || rows[0].QuestionID != "solo" {
		t.Fatalf("got %+v err=%v", rows, err)
	}
}
