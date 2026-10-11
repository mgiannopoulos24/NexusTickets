package postgres

import "testing"

func TestPrefixTSQuery(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"", ""},
		{"   ", ""},
		{"συναυ", "συναυ:*"},
		{"Συναυλία Αθή", "Συναυλία:* & Αθή:*"},
		{"  rock   live  ", "rock:* & live:*"},
		{"jazz-fest 2026", "jazz:* & fest:* & 2026:*"},
		// tsquery syntax is stripped rather than passed through.
		{"a & !b | c:* (d)", "a:* & b:* & c:* & d:*"},
		{"'; DROP TABLE events; --", "DROP:* & TABLE:* & events:*"},
		{"&|!():*", ""},
	}
	for _, c := range cases {
		if got := prefixTSQuery(c.in); got != c.want {
			t.Errorf("prefixTSQuery(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
