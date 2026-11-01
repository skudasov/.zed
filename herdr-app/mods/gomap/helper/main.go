// gomap prints the structs and func signatures of the Go module containing
// <dir>, one JSON row each, grouped by package dir. The gomap Herdr mod lists them.
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type Row struct {
	Pkg  string `json:"pkg"` // dir relative to the module root
	Kind string `json:"kind"`
	Text string `json:"text"`
	File string `json:"file"` // name only in the output: the dir is Root/Pkg
	Line int    `json:"line"`
	Pub  bool   `json:"pub"` // exported name
	// Change since the branch's base: "added", "changed" (signature or type),
	// "body" (only the inside) or "removed"; empty when untouched.
	Change string `json:"change,omitempty"`
	key    string // kind, receiver and name: the same declaration in both versions
	full   string // the declaration as printed, a type's fields and methods too
	from   int
	to     int
}

type Out struct {
	Root string `json:"root"`
	Base string `json:"base"` // what Change compares against; empty outside git
	Rows []Row  `json:"rows"`
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: gomap <dir>")
		os.Exit(2)
	}
	out, err := run(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(out); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func findRoot(dir string) (string, error) {
	dir, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	for d := dir; ; d = filepath.Dir(d) {
		if _, err := os.Stat(filepath.Join(d, "go.mod")); err == nil {
			return d, nil
		}
		if filepath.Dir(d) == d {
			return "", fmt.Errorf("no go.mod above %s", dir)
		}
	}
}

func run(dir string) (*Out, error) {
	root, err := findRoot(dir)
	if err != nil {
		return nil, err
	}
	fset := token.NewFileSet()
	var types, funcs []Row
	err = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		name := d.Name()
		if d.IsDir() {
			if path == root {
				return nil
			}
						// Nested modules are walked too: a repo of several (chainlink:
			// devenv, deployment, …) shows as one tree, and p narrows it.
			if strings.HasPrefix(name, ".") || name == "vendor" || name == "testdata" || name == "node_modules" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			return nil
		}
		pkg, _ := filepath.Rel(root, filepath.Dir(path))
		for _, r := range decls(fset, path, nil, pkg) {
			if r.Kind == "type" {
				types = append(types, r)
			} else {
				funcs = append(funcs, r)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	// Per package: types first, then funcs, each in file order.
	rows := append(types, funcs...)
	base, show, changed := changes(root)
	rows = compare(fset, root, rows, show, changed)
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].Pkg < rows[j].Pkg })
	// Names only: full paths were a third of the output, and Herdr's exec
	// keeps 8MB (chainlink with its nested modules is near that).
	for i := range rows {
		rows[i].File = filepath.Base(rows[i].File)
	}
	return &Out{Root: root, Base: base, Rows: rows}, nil
}

// compare sets Change on the rows of changed files by matching them with the
// same file at the base (show), and appends the declarations that are gone.
func compare(fset *token.FileSet, root string, rows []Row, show func(string) []byte, changed map[string][][2]int) []Row {
	old := map[string]map[string]Row{} // file → key → its row at the base
	for file := range changed {
		rel, err := filepath.Rel(root, file)
		if err != nil || strings.HasPrefix(rel, "..") || strings.HasSuffix(file, "_test.go") {
			continue
		}
		m := map[string]Row{}
		if src := show(file); src != nil {
			for _, r := range decls(fset, file, src, filepath.Dir(rel)) {
				m[r.key] = r
			}
		}
		old[file] = m
	}
	walked := map[string]bool{}
	for i := range rows {
		r := &rows[i]
		walked[r.File] = true
		was, ok := old[r.File]
		if !ok {
			continue
		}
		o, ok := was[r.key]
		delete(was, r.key)
		switch {
		case !ok:
			r.Change = "added"
		case o.full != r.full:
			r.Change = "changed"
		default:
			for _, c := range changed[r.File] {
				if c[0] <= r.to && c[1] >= r.from {
					r.Change = "body"
					break
				}
			}
		}
	}
	// What's left at the base is removed: from files still listed, or deleted.
	for file, was := range old {
		if !walked[file] && changed[file] != nil {
			continue // skipped by the walk (testdata, vendor, …) or has no decls
		}
		for _, o := range was {
			o.Change = "removed"
			rows = append(rows, o)
		}
	}
	return rows
}

// decls lists a file's types and funcs. src is its content, or nil to read path.
func decls(fset *token.FileSet, path string, src []byte, pkg string) []Row {
	var in any
	if src != nil {
		in = src // a nil []byte would parse as an empty file
	}
	f, err := parser.ParseFile(fset, path, in, parser.SkipObjectResolution)
	if err != nil {
		return nil // a broken file shouldn't hide the rest
	}
	var rows []Row
	for _, decl := range f.Decls {
		switch d := decl.(type) {
		case *ast.FuncDecl:
			from, to := span(fset, d.Doc, d)
			d.Body, d.Doc = nil, nil
			r := row(fset, pkg, "func", d)
			r.Pub, r.from, r.to = ast.IsExported(d.Name.Name), from, to
			r.key, r.full = "func "+recv(d)+d.Name.Name, r.Text
			rows = append(rows, r)
		case *ast.GenDecl:
			if d.Tok != token.TYPE {
				continue
			}
			for _, s := range d.Specs {
				ts := s.(*ast.TypeSpec)
				r := row(fset, pkg, "type", ts)
				r.Pub = ast.IsExported(ts.Name.Name)
				doc := ts.Doc
				if doc == nil && len(d.Specs) == 1 {
					doc = d.Doc
				}
				r.from, r.to = span(fset, doc, ts)
				r.key, r.full = "type "+ts.Name.Name, r.Text
				// Struct and interface bodies are long; the name is the glance.
				switch ts.Type.(type) {
				case *ast.StructType:
					r.Text = "type " + ts.Name.Name + " struct"
				case *ast.InterfaceType:
					r.Text = "type " + ts.Name.Name + " interface"
				default:
					r.Text = "type " + r.Text
				}
				rows = append(rows, r)
			}
		}
	}
	return rows
}

// recv is a method's receiver type and a dot ("Store."), empty for a func.
func recv(d *ast.FuncDecl) string {
	if d.Recv == nil || len(d.Recv.List) == 0 {
		return ""
	}
	t := d.Recv.List[0].Type
	if s, ok := t.(*ast.StarExpr); ok {
		t = s.X
	}
	switch x := t.(type) { // generic receivers: Store[T]
	case *ast.IndexExpr:
		t = x.X
	case *ast.IndexListExpr:
		t = x.X
	}
	if id, ok := t.(*ast.Ident); ok {
		return id.Name + "."
	}
	return ""
}

// span is the line range of a declaration, from its doc comment to its end.
func span(fset *token.FileSet, doc *ast.CommentGroup, node ast.Node) (int, int) {
	from := node.Pos()
	if doc != nil {
		from = doc.Pos()
	}
	return fset.Position(from).Line, fset.Position(node.End()).Line
}

// changes returns the lines of .go files changed since the branch left the
// default branch: commits, uncommitted edits, and untracked files (whole).
// Keyed by absolute path, a deleted file with no lines; show reads a file as
// it was at the fork (nil if it wasn't there). Empty outside git.
func changes(dir string) (string, func(string) []byte, map[string][][2]int) {
	git := func(args ...string) string {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		out, err := cmd.Output()
		if err != nil {
			return ""
		}
		return strings.TrimSpace(string(out))
	}
	top := git("rev-parse", "--show-toplevel")
	if top == "" {
		return "", nil, nil
	}
	base := git("rev-parse", "--abbrev-ref", "origin/HEAD")
	for _, b := range []string{"origin/main", "origin/master", "main", "master"} {
		if base != "" {
			break
		}
		if git("rev-parse", "--verify", "--quiet", b) != "" {
			base = b
		}
	}
	if base == "" {
		return "", nil, nil
	}
	fork := git("merge-base", "HEAD", base)
	if fork == "" {
		return "", nil, nil
	}
	show := func(path string) []byte {
		rel, _ := filepath.Rel(top, path)
		cmd := exec.Command("git", "show", fork+":"+filepath.ToSlash(rel))
		cmd.Dir = top
		out, err := cmd.Output()
		if err != nil {
			return nil
		}
		return out
	}
	cmd := exec.Command("git", "diff", "-U0", "--no-color", "--no-ext-diff", "--no-renames", fork, "--", "*.go")
	cmd.Dir = top
	out, _ := cmd.Output()
	changed := parseDiff(top, string(out))
	for _, f := range strings.Split(git("ls-files", "--others", "--exclude-standard", "--full-name", "--", "*.go"), "\n") {
		if f != "" {
			changed[filepath.Join(top, f)] = [][2]int{{1, 1 << 30}}
		}
	}
	return base, show, changed
}

// parseDiff reads `git diff -U0` output into the new-side line ranges per file.
// A pure deletion counts as a change to the line it happened at; a deleted
// file is listed with no lines.
func parseDiff(top, diff string) map[string][][2]int {
	changed := map[string][][2]int{}
	file, old := "", ""
	for _, line := range strings.Split(diff, "\n") {
		switch {
		case strings.HasPrefix(line, "--- "):
			old = ""
			if p, ok := strings.CutPrefix(line, "--- a/"); ok {
				old = p
			}
		case strings.HasPrefix(line, "+++ "):
			file = ""
			if p, ok := strings.CutPrefix(line, "+++ b/"); ok {
				file = filepath.Join(top, p)
			} else if old != "" {
				changed[filepath.Join(top, old)] = nil
			}
		case strings.HasPrefix(line, "@@ ") && file != "":
			// @@ -a,b +c,d @@
			fields := strings.Fields(line)
			if len(fields) < 3 {
				continue
			}
			start, count, _ := strings.Cut(strings.TrimPrefix(fields[2], "+"), ",")
			from, _ := strconv.Atoi(start)
			n := 1
			if count != "" {
				n, _ = strconv.Atoi(count)
			}
			to := from + n - 1
			if n == 0 {
				to = from
			}
			changed[file] = append(changed[file], [2]int{from, to})
		}
	}
	return changed
}

func row(fset *token.FileSet, pkg, kind string, node ast.Node) Row {
	var b strings.Builder
	printer.Fprint(&b, fset, node)
	pos := fset.Position(node.Pos())
	return Row{Pkg: pkg, Kind: kind, Text: strings.Join(strings.Fields(b.String()), " "), File: pos.Filename, Line: pos.Line}
}
