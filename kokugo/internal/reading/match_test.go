package reading

import "testing"

func TestSelectionLikelyFromPassage(t *testing.T) {
	passPlain := `<p>ねこは庭でねている。</p>`
	passRuby := `<p>ねこは<ruby>庭<rt>にわ</rt></ruby>でねている。</p>`
	cases := []struct {
		pass, sel string
		want      bool
	}{
		{passPlain, "ねこは", true},
		{passPlain, "庭で", true},
		{passRuby, "庭で", true},
		{passRuby, "ねこは", true},
		{passRuby, "庭にわ", true},
		{passRuby, "にわで", true},
		{passPlain, "存在しない", false},
		{passPlain, "", false},
		{passPlain, "   ", false},
	}
	for _, tc := range cases {
		got := SelectionLikelyFromPassage(tc.sel, tc.pass)
		if got != tc.want {
			t.Errorf("SelectionLikelyFromPassage(pass=%q sel=%q)=%v want %v", tc.pass, tc.sel, got, tc.want)
		}
	}
}

func TestStripHTMLToPlain(t *testing.T) {
	got := StripHTMLToPlain(`<p>あいう</p>`)
	if got != "あいう" {
		t.Fatalf("got %q", got)
	}
}
