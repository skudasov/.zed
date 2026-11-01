package main

import (
	"fmt"
	"slices"
	"testing"
)

func TestRun(t *testing.T) {
	out, err := run("testdata/fx")
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, r := range out.Rows {
		got = append(got, fmt.Sprint(r.Pkg, " ", r.Text, " ", r.Pub))
	}
	want := []string{
		". type Store struct true",
		". func Save() error true",
		". func (s *Store) Get(key string) (string, bool) true",
		"sub type ID = int true",
		"sub type id struct false",
		"sub func Pure(a, b int) int true",
		"sub func helper() false",
	}
	if !slices.Equal(got, want) {
		t.Errorf("rows:\n%q\nwant:\n%q", got, want)
	}
}
