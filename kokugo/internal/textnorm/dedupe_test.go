package textnorm

import "testing"

func TestPlainForDedupe(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"", ""},
		{"  春  ", "春"},
		{"<ruby>春<rt>はる</rt></ruby>", "春"},
		{"<ruby>生<rt>いきる</rt></ruby>と<ruby>生<rt>うまれる</rt></ruby>", "生と生"},
	}
	for _, tt := range tests {
		got := PlainForDedupe(tt.in)
		if got != tt.want {
			t.Errorf("PlainForDedupe(%q) = %q; want %q", tt.in, got, tt.want)
		}
	}
}
