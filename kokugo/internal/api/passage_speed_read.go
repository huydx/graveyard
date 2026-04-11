package api

import (
	"bytes"
	"fmt"
	"html"
	"strings"
	"unicode"
	"unicode/utf8"

	htmlnorm "golang.org/x/net/html"
	normunicode "golang.org/x/text/unicode/norm"
)

func passageHTMLBodyRoots(passageHTML string) ([]*htmlnorm.Node, error) {
	doc, err := htmlnorm.Parse(strings.NewReader("<html><head></head><body>" + passageHTML + "</body></html>"))
	if err != nil {
		return nil, err
	}
	var body *htmlnorm.Node
	var findBody func(*htmlnorm.Node)
	findBody = func(n *htmlnorm.Node) {
		if n == nil || body != nil {
			return
		}
		if n.Type == htmlnorm.ElementNode && n.Data == "body" {
			body = n
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findBody(c)
		}
	}
	findBody(doc)
	if body == nil {
		return nil, fmt.Errorf("no body in parsed passage")
	}
	var roots []*htmlnorm.Node
	for c := body.FirstChild; c != nil; c = c.NextSibling {
		roots = append(roots, c)
	}
	return roots, nil
}

// PassageSpeedReadVisibleAndAtoms extracts reading-order visible text (furigana excluded, same idea as
// passagePlainForMatch) and assigns atom IDs so each rune inside one ruby base shares the same ID (>0).
func PassageSpeedReadVisibleAndAtoms(passageHTML string) (vis string, atoms []int, err error) {
	roots, err := passageHTMLBodyRoots(passageHTML)
	if err != nil {
		return "", nil, fmt.Errorf("parse passage html: %w", err)
	}
	var vr []rune
	var at []int
	nextRuby := 1
	var walk func(*htmlnorm.Node)
	walk = func(n *htmlnorm.Node) {
		if n == nil {
			return
		}
		switch n.Type {
		case htmlnorm.TextNode:
			for _, r := range normunicode.NFC.String(n.Data) {
				vr = append(vr, r)
				at = append(at, 0)
			}
		case htmlnorm.ElementNode:
			switch n.Data {
			case "ruby":
				rid := nextRuby
				nextRuby++
				for _, r := range normunicode.NFC.String(rubyBaseVisible(n)) {
					vr = append(vr, r)
					at = append(at, rid)
				}
				return
			case "rt", "rp":
				return
			default:
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					walk(c)
				}
			}
		}
	}
	for _, root := range roots {
		walk(root)
	}
	vr, at = trimSpeedReadVisRunes(vr, at)
	return string(vr), at, nil
}

func trimSpeedReadVisRunes(vis []rune, atoms []int) ([]rune, []int) {
	if len(vis) != len(atoms) {
		return vis, atoms
	}
	i, j := 0, len(vis)
	for i < j && unicode.IsSpace(vis[i]) {
		i++
	}
	for j > i && unicode.IsSpace(vis[j-1]) {
		j--
	}
	if i == 0 && j == len(vis) {
		return vis, atoms
	}
	return vis[i:j], atoms[i:j]
}

func rubyBaseVisible(ruby *htmlnorm.Node) string {
	var b strings.Builder
	var sub func(*htmlnorm.Node)
	sub = func(n *htmlnorm.Node) {
		if n == nil {
			return
		}
		switch n.Type {
		case htmlnorm.TextNode:
			b.WriteString(n.Data)
		case htmlnorm.ElementNode:
			if n.Data == "rt" || n.Data == "rp" {
				return
			}
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				sub(c)
			}
		}
	}
	for c := ruby.FirstChild; c != nil; c = c.NextSibling {
		sub(c)
	}
	return b.String()
}

func renderNodeSubtree(n *htmlnorm.Node) (string, error) {
	var buf bytes.Buffer
	if err := htmlnorm.Render(&buf, n); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func isKeptRuneCompactMatch(r rune) bool {
	switch r {
	case '\u200b', '\u200c', '\u200d', '\ufeff', '\u2060':
		return false
	}
	if r >= 0xfe00 && r <= 0xfe0f {
		return false
	}
	return !unicode.IsSpace(r)
}

// bunsetsuStrictKey matches explain-selection style: NFC + drop spaces/ZW.
func bunsetsuStrictKey(s string) string {
	return compactPassageMatch(s)
}

// bunsetsuLooseKey adds NFKC so full-width digits/punct and compatibility variants align with model output.
func bunsetsuLooseKey(s string) string {
	return compactPassageMatch(normunicode.NFKC.String(normunicode.NFC.String(s)))
}

func looseRuneContributionCount(r rune) int {
	t := normunicode.NFKC.String(string(r))
	n := 0
	for _, x := range t {
		if isKeptRuneCompactMatch(x) {
			n++
		}
	}
	return n
}

// singleRuneDeletionFromALinesB reports index i in a such that removing a[i] yields b (both []rune content).
func singleRuneDeletionFromALinesB(a, b []rune) (skipAt int, ok bool) {
	if len(a) != len(b)+1 {
		return 0, false
	}
	ai, bi := 0, 0
	var skipped bool
	skipAt = -1
	for ai < len(a) && bi < len(b) {
		if a[ai] == b[bi] {
			ai++
			bi++
			continue
		}
		if skipped {
			return 0, false
		}
		skipped = true
		skipAt = ai
		ai++
	}
	if bi != len(b) {
		return 0, false
	}
	if skipped && ai == len(a) && skipAt >= 0 {
		return skipAt, true
	}
	if !skipped && ai == len(a)-1 {
		return len(a) - 1, true
	}
	return 0, false
}

func insertRuneByLooseOffset(seg string, off int, r rune) (string, bool) {
	if off < 0 {
		return "", false
	}
	rs := []rune(seg)
	lo := 0
	for i := 0; i < len(rs); i++ {
		if lo == off {
			return string(append(append(append([]rune(nil), rs[:i]...), r), rs[i:]...)), true
		}
		lo += looseRuneContributionCount(rs[i])
	}
	if lo == off {
		return seg + string(r), true
	}
	return "", false
}

func insertMissingRuneInSegmentsByJoinIndex(segs []string, joinIdx int, r rune) ([]string, bool) {
	out := append([]string(nil), segs...)
	cum := 0
	for si := range out {
		L := utf8.RuneCountInString(bunsetsuLooseKey(out[si]))
		if joinIdx <= cum+L {
			off := joinIdx - cum
			ns, ok := insertRuneByLooseOffset(out[si], off, r)
			if !ok {
				return nil, false
			}
			out[si] = ns
			return out, true
		}
		cum += L
	}
	if len(out) > 0 && joinIdx == cum {
		out[len(out)-1] += string(r)
		return out, true
	}
	return nil, false
}

func removeRuneAtJoinLooseIndex(seg string, localIdx int, want rune) (string, bool) {
	rs := []rune(seg)
	lo := 0
	for i := 0; i < len(rs); i++ {
		pk := []rune(bunsetsuLooseKey(string(rs[i])))
		ln := len(pk)
		if localIdx >= lo && localIdx < lo+ln {
			sub := localIdx - lo
			if sub >= len(pk) || pk[sub] != want {
				return "", false
			}
			if ln != 1 {
				return "", false
			}
			return string(append(rs[:i], rs[i+1:]...)), true
		}
		lo += ln
	}
	return "", false
}

func removeRuneFromSegmentsByJoinIndex(segs []string, joinIdx int, want rune) ([]string, bool) {
	out := append([]string(nil), segs...)
	cum := 0
	for si := range out {
		L := utf8.RuneCountInString(bunsetsuLooseKey(out[si]))
		if joinIdx < cum+L {
			off := joinIdx - cum
			ns, ok := removeRuneAtJoinLooseIndex(out[si], off, want)
			if !ok {
				return nil, false
			}
			out[si] = ns
			return out, true
		}
		cum += L
	}
	return nil, false
}

// tryPatchBunsetsuOneLooseRune fixes a single missing or extra content rune in the model join vs passage (LLM drop/add).
func tryPatchBunsetsuOneLooseRune(vis string, segs []string) ([]string, bool) {
	vk := []rune(bunsetsuLooseKey(vis))
	joined := strings.Join(segs, "")
	jk := []rune(bunsetsuLooseKey(joined))
	if len(vk) == len(jk)+1 {
		del, ok := singleRuneDeletionFromALinesB(vk, jk)
		if !ok {
			return nil, false
		}
		return insertMissingRuneInSegmentsByJoinIndex(segs, del, vk[del])
	}
	if len(jk) == len(vk)+1 {
		del, ok := singleRuneDeletionFromALinesB(jk, vk)
		if !ok {
			return nil, false
		}
		return removeRuneFromSegmentsByJoinIndex(segs, del, jk[del])
	}
	return nil, false
}

// alignBunsetsuSegmentsToVisible maps model segments onto the passage visible string. Exact join match
// uses the model's boundaries; otherwise strictKey (spaces/ZW) or looseKey (+NFKC) with reprojection.
func alignBunsetsuSegmentsToVisible(vis string, modelSegments []string) ([]string, error) {
	segs := append([]string(nil), modelSegments...)
	joined := strings.Join(segs, "")
	if joined == vis {
		return segs, nil
	}
	for range 3 {
		patched, ok := tryPatchBunsetsuOneLooseRune(vis, segs)
		if !ok {
			break
		}
		segs = patched
		joined = strings.Join(segs, "")
		if joined == vis {
			return segs, nil
		}
		if bunsetsuLooseKey(joined) == bunsetsuLooseKey(vis) {
			break
		}
	}
	if bunsetsuStrictKey(joined) == bunsetsuStrictKey(vis) {
		return reprojectBunsetsuOntoVisibleStrict([]rune(vis), segs)
	}
	if bunsetsuLooseKey(joined) == bunsetsuLooseKey(vis) {
		return reprojectBunsetsuOntoVisibleLoose([]rune(vis), segs)
	}
	return nil, fmt.Errorf("segments join does not match passage visible text (strict key lens %d vs %d, loose %d vs %d)",
		utf8.RuneCountInString(bunsetsuStrictKey(joined)),
		utf8.RuneCountInString(bunsetsuStrictKey(vis)),
		utf8.RuneCountInString(bunsetsuLooseKey(joined)),
		utf8.RuneCountInString(bunsetsuLooseKey(vis)),
	)
}

func reprojectBunsetsuOntoVisibleStrict(vis []rune, modelSegments []string) ([]string, error) {
	quotas := make([]int, len(modelSegments))
	for i, seg := range modelSegments {
		quotas[i] = utf8.RuneCountInString(bunsetsuStrictKey(seg))
	}
	total := 0
	for _, q := range quotas {
		total += q
	}
	want := utf8.RuneCountInString(bunsetsuStrictKey(string(vis)))
	if total != want {
		return nil, fmt.Errorf("bunsetsu segment lengths do not add up to passage (model %d vs passage %d)", total, want)
	}
	out := make([]string, len(modelSegments))
	idx := 0
	lastNonEmpty := -1
	var lastStart int
	for si, need := range quotas {
		if need == 0 {
			out[si] = ""
			continue
		}
		start := idx
		lastStart = start
		lastNonEmpty = si
		got := 0
		for idx < len(vis) && got < need {
			if isKeptRuneCompactMatch(vis[idx]) {
				got++
			}
			idx++
		}
		if got < need {
			return nil, fmt.Errorf("bunsetsu reproject underflow at segment %d", si)
		}
		out[si] = string(vis[start:idx])
	}
	if idx < len(vis) {
		if lastNonEmpty < 0 {
			return nil, fmt.Errorf("bunsetsu reproject trailing runes with no segment")
		}
		out[lastNonEmpty] = string(vis[lastStart:])
	}
	return out, nil
}

func reprojectBunsetsuOntoVisibleLoose(vis []rune, modelSegments []string) ([]string, error) {
	quotas := make([]int, len(modelSegments))
	for i, seg := range modelSegments {
		quotas[i] = utf8.RuneCountInString(bunsetsuLooseKey(seg))
	}
	total := 0
	for _, q := range quotas {
		total += q
	}
	want := utf8.RuneCountInString(bunsetsuLooseKey(string(vis)))
	if total != want {
		return nil, fmt.Errorf("bunsetsu loose segment quotas do not add up (model %d vs passage %d)", total, want)
	}
	sumContrib := 0
	for _, r := range vis {
		sumContrib += looseRuneContributionCount(r)
	}
	if sumContrib != want {
		return nil, fmt.Errorf("bunsetsu loose per-rune contributions %d != passage key %d", sumContrib, want)
	}
	out := make([]string, len(modelSegments))
	idx := 0
	lastNonEmpty := -1
	var lastStart int
	for si, need := range quotas {
		if need == 0 {
			out[si] = ""
			continue
		}
		start := idx
		lastStart = start
		lastNonEmpty = si
		got := 0
		for got < need && idx < len(vis) {
			c := looseRuneContributionCount(vis[idx])
			if c == 0 {
				idx++
				continue
			}
			if got+c > need {
				return nil, fmt.Errorf("bunsetsu loose reproject: boundary inside NFKC-expanded rune")
			}
			got += c
			idx++
		}
		if got < need {
			return nil, fmt.Errorf("bunsetsu loose reproject underflow at segment %d", si)
		}
		out[si] = string(vis[start:idx])
	}
	if idx < len(vis) {
		if lastNonEmpty < 0 {
			return nil, fmt.Errorf("bunsetsu loose reproject trailing runes with no segment")
		}
		out[lastNonEmpty] = string(vis[lastStart:])
	}
	return out, nil
}

func mergeBunsetsuCutsAtRuby(vis []rune, atoms []int, modelSegments []string) ([]string, error) {
	if len(vis) != len(atoms) {
		return nil, fmt.Errorf("atom length mismatch")
	}
	visStr := string(vis)
	aligned, err := alignBunsetsuSegmentsToVisible(visStr, modelSegments)
	if err != nil {
		return nil, err
	}
	n := len(vis)
	if n == 0 {
		return nil, nil
	}
	noSplitBefore := make([]bool, n)
	for i := 1; i < n; i++ {
		noSplitBefore[i] = atoms[i-1] > 0 && atoms[i-1] == atoms[i]
	}
	var cuts []int
	acc := 0
	for i := 0; i < len(aligned)-1; i++ {
		acc += utf8.RuneCountInString(aligned[i])
		if acc <= 0 || acc >= n {
			return nil, fmt.Errorf("invalid segment boundary")
		}
		cuts = append(cuts, acc)
	}
	var good []int
	for _, c := range cuts {
		if c < len(noSplitBefore) && noSplitBefore[c] {
			continue
		}
		good = append(good, c)
	}
	return splitRunesAtCuts(vis, good), nil
}

func splitRunesAtCuts(vis []rune, cuts []int) []string {
	if len(cuts) == 0 {
		return []string{string(vis)}
	}
	out := make([]string, 0, len(cuts)+1)
	start := 0
	for _, c := range cuts {
		out = append(out, string(vis[start:c]))
		start = c
	}
	out = append(out, string(vis[start:]))
	return out
}

type speedReadHTMLMapper struct {
	segments []string
	si       int
	need     int
	cur      strings.Builder
	out      []string
}

func (w *speedReadHTMLMapper) flush() {
	w.out = append(w.out, w.cur.String())
	w.cur.Reset()
	w.si++
	if w.si < len(w.segments) {
		w.need = utf8.RuneCountInString(w.segments[w.si])
	} else {
		w.need = 0
	}
}

func (w *speedReadHTMLMapper) walk(n *htmlnorm.Node) error {
	if n == nil {
		return nil
	}
	switch n.Type {
	case htmlnorm.TextNode:
		for _, r := range n.Data {
			if w.need <= 0 {
				return fmt.Errorf("speed read map: unexpected text rune")
			}
			w.cur.WriteString(html.EscapeString(string(r)))
			w.need--
			if w.need == 0 {
				w.flush()
			}
		}
	case htmlnorm.ElementNode:
		switch n.Data {
		case "ruby":
			outer, err := renderNodeSubtree(n)
			if err != nil {
				return err
			}
			vis := rubyBaseVisible(n)
			nr := utf8.RuneCountInString(vis)
			if nr == 0 {
				return fmt.Errorf("speed read map: empty ruby base")
			}
			if w.need < nr {
				return fmt.Errorf("speed read map: ruby does not fit segment")
			}
			w.cur.WriteString(outer)
			w.need -= nr
			if w.need == 0 {
				w.flush()
			}
			return nil
		case "rt", "rp":
			return nil
		default:
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if err := w.walk(c); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// MapSpeedReadSegmentsToHTML maps merged plain bunsetsu segments to HTML fragments matching passage markup.
func MapSpeedReadSegmentsToHTML(passageHTML string, mergedSegments []string) ([]string, error) {
	if len(mergedSegments) == 0 {
		return nil, nil
	}
	roots, err := passageHTMLBodyRoots(passageHTML)
	if err != nil {
		return nil, fmt.Errorf("parse passage html: %w", err)
	}
	w := &speedReadHTMLMapper{
		segments: mergedSegments,
		si:       0,
		need:     utf8.RuneCountInString(mergedSegments[0]),
	}
	for _, root := range roots {
		if err := w.walk(root); err != nil {
			return nil, err
		}
	}
	if w.si != len(mergedSegments) || w.need != 0 || w.cur.Len() != 0 {
		return nil, fmt.Errorf("speed read map: incomplete (si=%d need=%d)", w.si, w.need)
	}
	return w.out, nil
}
