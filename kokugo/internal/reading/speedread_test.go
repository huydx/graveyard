package reading

import (
	"strings"
	"testing"

	normunicode "golang.org/x/text/unicode/norm"
)

func normString(s string) string {
	return normunicode.NFC.String(s)
}

func TestPassageSpeedReadVisibleMatchesPlain(t *testing.T) {
	cases := []string{
		`<p>ねこは庭でねている。</p>`,
		`<p>ねこは<ruby>庭<rt>にわ</rt></ruby>でねている。</p>`,
		`<p>あいう<br>えお</p>`,
		`<span><ruby>大阪<rt>おおさか</rt></ruby>へ</span>`,
	}
	for _, h := range cases {
		got, atoms, err := PassageSpeedReadVisibleAndAtoms(h)
		if err != nil {
			t.Fatalf("html=%q err=%v", h, err)
		}
		want := PassagePlainForMatch(h)
		// Parser path NFC-normalizes chunks; plain strip path may differ in composition.
		if normString(got) != normString(want) {
			t.Errorf("visible mismatch html=%q\ngot  %q\nwant %q", h, got, want)
		}
		if len(atoms) != len([]rune(got)) {
			t.Errorf("atoms len html=%q got %d want %d", h, len(atoms), len([]rune(got)))
		}
	}
}

func TestMergeBunsetsuCutsInsideOneRuby(t *testing.T) {
	html := `<p><ruby>大阪<rt>おおさか</rt></ruby>へ</p>`
	vis, atoms, err := PassageSpeedReadVisibleAndAtoms(html)
	if err != nil {
		t.Fatal(err)
	}
	// Invalid cut between 大 and 阪 (same ruby); merge into one segment.
	merged, err := MergeBunsetsuCutsAtRuby([]rune(vis), atoms, []string{"大", "阪へ"})
	if err != nil {
		t.Fatal(err)
	}
	if len(merged) != 1 || merged[0] != "大阪へ" {
		t.Fatalf("merged=%q want [大阪へ]", merged)
	}
	htmlSegs, err := MapSpeedReadSegmentsToHTML(html, merged)
	if err != nil {
		t.Fatal(err)
	}
	if len(htmlSegs) != 1 || !strings.Contains(htmlSegs[0], "ruby") {
		t.Fatalf("htmlSegs=%v", htmlSegs)
	}
}

func TestSingleRuneDeletionFromALinesB(t *testing.T) {
	i, ok := singleRuneDeletionFromALinesB([]rune("abcde"), []rune("abde"))
	if !ok || i != 2 {
		t.Fatalf("got i=%d ok=%v", i, ok)
	}
	i, ok = singleRuneDeletionFromALinesB([]rune("ab"), []rune("a"))
	if !ok || i != 1 {
		t.Fatalf("trailing got i=%d ok=%v", i, ok)
	}
}

func TestPatchBunsetsuDroppedCharAligns(t *testing.T) {
	vis := "abcde"
	model := []string{"ab", "de"}
	fixed, err := alignBunsetsuSegmentsToVisible(vis, model)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(fixed, "") != vis {
		t.Fatalf("got %q", fixed)
	}
}

func TestPatchBunsetsuExtraCharRemoved(t *testing.T) {
	vis := "abc"
	model := []string{"abxc"}
	fixed, err := alignBunsetsuSegmentsToVisible(vis, model)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(fixed, "") != vis {
		t.Fatalf("got %q", fixed)
	}
}

func TestAlignBunsetsuLooseFullWidthLatin(t *testing.T) {
	// Passage contains full-width latin; model returns half-width (NFKC aligns).
	vis := "Ａは"
	model := []string{"A", "は"}
	aligned, err := alignBunsetsuSegmentsToVisible(vis, model)
	if err != nil {
		t.Fatal(err)
	}
	if len(aligned) != 2 || aligned[0] != "Ａ" || aligned[1] != "は" {
		t.Fatalf("aligned=%q", aligned)
	}
}

func TestAlignBunsetsuReprojectsSpaces(t *testing.T) {
	vis := "学校　へ行く" // full-width space; model omits it
	model := []string{"学校", "へ", "行く"}
	aligned, err := alignBunsetsuSegmentsToVisible(vis, model)
	if err != nil {
		t.Fatal(err)
	}
	if len(aligned) != 3 {
		t.Fatalf("aligned=%q", aligned)
	}
	if aligned[0] != "学校" || aligned[1] != "　へ" || aligned[2] != "行く" {
		t.Fatalf("aligned=%q", aligned)
	}
	visRunes, atoms, err := PassageSpeedReadVisibleAndAtoms(`<p>学校　へ行く</p>`)
	if err != nil {
		t.Fatal(err)
	}
	merged, err := MergeBunsetsuCutsAtRuby([]rune(visRunes), atoms, model)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(merged, "") != visRunes {
		t.Fatalf("merged join=%q want %q", strings.Join(merged, ""), visRunes)
	}
}

func TestMapSpeedReadSegmentsToHTMLTwoChunks(t *testing.T) {
	html := `<p><ruby>大阪<rt>おおさか</rt></ruby>へいく</p>`
	merged := []string{"大阪", "へいく"}
	htmlSegs, err := MapSpeedReadSegmentsToHTML(html, merged)
	if err != nil {
		t.Fatal(err)
	}
	if len(htmlSegs) != 2 {
		t.Fatalf("htmlSegs=%v", htmlSegs)
	}
	if !strings.Contains(htmlSegs[0], "大阪") || !strings.Contains(htmlSegs[0], "ruby") {
		t.Errorf("seg0=%q", htmlSegs[0])
	}
	if htmlSegs[1] != "へいく" {
		t.Errorf("seg1=%q want へいく", htmlSegs[1])
	}
}
