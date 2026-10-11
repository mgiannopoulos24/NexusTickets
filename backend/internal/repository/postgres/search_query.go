package postgres

import (
	"strings"
	"unicode"
)

// prefixTSQuery turns free text into a to_tsquery expression that requires
// every word, each as a prefix (`συναυ:* & αθή:*`): while typing, any word may
// still be half written. Anything other than letters and digits splits words,
// so tsquery operators typed by the user cannot reach the parser. It returns
// "" when no word is left.
func prefixTSQuery(text string) string {
	words := strings.FieldsFunc(text, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	if len(words) == 0 {
		return ""
	}
	for i := range words {
		words[i] += ":*"
	}
	return strings.Join(words, " & ")
}
