package ai

import "testing"

func TestExtractFirstJSONObject(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{`{"segments":["a"]}`, `{"segments":["a"]}`},
		{`{"segments":["a"]} trailing`, `{"segments":["a"]}`},
		{`{"segments":["a\"b"]} x`, `{"segments":["a\"b"]}`},
		{"noise {\"segments\":[\"x\"]} end", `{"segments":["x"]}`},
	}
	for _, tc := range cases {
		got, err := ExtractFirstJSONObject(tc.in)
		if err != nil {
			t.Fatalf("in=%q err=%v", tc.in, err)
		}
		if got != tc.want {
			t.Errorf("in=%q\ngot  %q\nwant %q", tc.in, got, tc.want)
		}
	}
}
