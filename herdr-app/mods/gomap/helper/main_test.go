package main

import (
	"fmt"
	"go/token"
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
		"nested func N() true",
		"sub type ID = int true",
		"sub type id struct false",
		"sub func Pure(a, b int) int true",
		"sub func helper() false",
	}
	if !slices.Equal(got, want) {
		t.Errorf("rows:\n%q\nwant:\n%q", got, want)
	}
}

func TestCompare(t *testing.T) {
	fset := token.NewFileSet()
	base := "package a\ntype T struct{ A int }\nfunc Same() {}\nfunc Body() {\n}\nfunc Sig(a int) {}\nfunc Gone() {}\n"
	now := "package a\ntype T struct{ A, B int }\nfunc Same() {}\nfunc Body() {\n\tx()\n}\nfunc Sig(a string) {}\nfunc New() {}\n"
	rows := decls(fset, "/r/a.go", []byte(now), ".")
	show := func(string) []byte { return []byte(base) }
	var got []string
	for _, r := range compare(fset, "/r", rows, show, map[string][][2]int{"/r/a.go": {{2, 2}, {5, 5}, {7, 8}}}) {
		got = append(got, r.key+":"+r.Change)
	}
	want := []string{"type T:changed", "func Same:", "func Body:body", "func Sig:changed", "func New:added", "func Gone:removed"}
	if !slices.Equal(got, want) {
		t.Errorf("got %q want %q", got, want)
	}
}

func TestParseDiff(t *testing.T) {
	diff := `diff --git a/a.go b/a.go
--- a/a.go
+++ b/a.go
@@ -3 +3,2 @@ func x() {
-old
+new
+new2
@@ -10,2 +11,0 @@ func y() {
-gone
-gone
diff --git a/b.go b/b.go
deleted file mode 100644
--- a/b.go
+++ /dev/null
@@ -1 +0,0 @@
-x
`
	got := parseDiff("/r", diff)
	want := map[string][][2]int{"/r/a.go": {{3, 4}, {11, 11}}, "/r/b.go": nil}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("got %v want %v", got, want)
	}
}
