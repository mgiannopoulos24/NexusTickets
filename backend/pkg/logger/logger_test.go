package logger

import (
	"testing"
)

func TestNewDevelopment(t *testing.T) {
	z, err := New("development")
	if err != nil {
		t.Fatalf("New('development') error: %v", err)
	}
	if z == nil {
		t.Fatal("expected non-nil logger")
	}
	z.Sync()
}

func TestNewStaging(t *testing.T) {
	z, err := New("staging")
	if err != nil {
		t.Fatalf("New('staging') error: %v", err)
	}
	if z == nil {
		t.Fatal("expected non-nil logger")
	}
	z.Sync()
}

func TestNewProduction(t *testing.T) {
	z, err := New("production")
	if err != nil {
		t.Fatalf("New('production') error: %v", err)
	}
	if z == nil {
		t.Fatal("expected non-nil logger")
	}
	z.Sync()
}

func TestNewInvalidEnv(t *testing.T) {
	_, err := New("invalid")
	if err == nil {
		t.Fatal("expected error for invalid env")
	}
}

func TestNewEmptyEnv(t *testing.T) {
	_, err := New("")
	if err == nil {
		t.Fatal("expected error for empty env")
	}
}
