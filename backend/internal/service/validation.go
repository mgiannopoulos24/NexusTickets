package service

import (
	"regexp"
	"strings"
	"unicode"

	"nexustickets/internal/domain"
)

// Registration field validation (assignment §2). These are deliberately
// permissive about international formats and strict only about the things that
// would otherwise produce unusable records.

const (
	// MinPasswordLength is the shortest password the service will accept.
	MinPasswordLength = 8
	// MaxPasswordLength guards against bcrypt's 72-byte input truncation.
	MaxPasswordLength = 72
)

var (
	// emailRe is a pragmatic single-@ check: a local part, a domain with at
	// least one dot, and a 2+ character TLD. Full RFC 5322 is not worth it.
	emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$`)

	// phoneRe accepts an optional leading +, then digits and the usual
	// separators (space, dash, dot, parentheses). The digit count is checked
	// separately in ValidPhone.
	phoneRe = regexp.MustCompile(`^\+?[0-9(][0-9\s().-]{6,23}$`)

	// vatRe matches the Greek ΑΦΜ format: exactly 9 digits.
	vatRe = regexp.MustCompile(`^[0-9]{9}$`)

	digitsRe = regexp.MustCompile(`[0-9]`)
)

// ValidEmail reports whether the address is structurally usable.
func ValidEmail(email string) bool {
	e := strings.TrimSpace(email)
	if e == "" || len(e) > 254 {
		return false
	}
	return emailRe.MatchString(e)
}

// ValidPhone reports whether the number has a plausible shape and 8-15 digits.
func ValidPhone(phone string) bool {
	p := strings.TrimSpace(phone)
	if !phoneRe.MatchString(p) {
		return false
	}
	digits := len(digitsRe.FindAllString(p, -1))
	return digits >= 8 && digits <= 15
}

// ValidVATNumber reports whether the ΑΦΜ is exactly 9 digits.
func ValidVATNumber(vat string) bool {
	return vatRe.MatchString(strings.TrimSpace(vat))
}

// ValidatePassword enforces a minimum strength: at least MinPasswordLength
// characters with both a letter and a digit. Returns a message suitable for
// showing to the user.
func ValidatePassword(password string) error {
	if len(password) < MinPasswordLength {
		return domain.Invalid("password must be at least %d characters", MinPasswordLength)
	}
	if len(password) > MaxPasswordLength {
		return domain.Invalid("password must be at most %d characters", MaxPasswordLength)
	}

	var hasLetter, hasDigit bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if !hasLetter || !hasDigit {
		return domain.Invalid("password must contain at least one letter and one digit")
	}
	return nil
}
