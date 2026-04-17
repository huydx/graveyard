package store

import "testing"

func TestNormalizeExerciseTitle(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"", ""},
		{"  hello  ", "hello"},
		{"おともださにナリマ小", "おともだちになります"},
		{"A · B", "A · B"},
	}
	for _, tt := range tests {
		got := NormalizeExerciseTitle(tt.in)
		if got != tt.want {
			t.Errorf("NormalizeExerciseTitle(%q) = %q; want %q", tt.in, got, tt.want)
		}
	}
}
