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
	"path/filepath"
	"sort"
	"strings"
)

type Row struct {
	Pkg  string `json:"pkg"` // dir relative to the module root
	Kind string `json:"kind"`
	Text string `json:"text"`
	File string `json:"file"`
	Line int    `json:"line"`
	Pub  bool   `json:"pub"` // exported name
}

type Out struct {
	Root string `json:"root"`
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
			// Skip hidden dirs, vendor, testdata and nested modules.
			if strings.HasPrefix(name, ".") || name == "vendor" || name == "testdata" {
				return filepath.SkipDir
			}
			if _, err := os.Stat(filepath.Join(path, "go.mod")); err == nil {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			return nil
		}
		f, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
		if err != nil {
			return nil // a broken file shouldn't hide the rest
		}
		pkg, _ := filepath.Rel(root, filepath.Dir(path))
		for _, decl := range f.Decls {
			switch d := decl.(type) {
			case *ast.FuncDecl:
				d.Body, d.Doc = nil, nil
				r := row(fset, pkg, "func", d)
				r.Pub = ast.IsExported(d.Name.Name)
				funcs = append(funcs, r)
			case *ast.GenDecl:
				if d.Tok != token.TYPE {
					continue
				}
				for _, s := range d.Specs {
					ts := s.(*ast.TypeSpec)
					r := row(fset, pkg, "type", ts)
					r.Pub = ast.IsExported(ts.Name.Name)
					// Struct and interface bodies are long; the name is the glance.
					switch ts.Type.(type) {
					case *ast.StructType:
						r.Text = "type " + ts.Name.Name + " struct"
					case *ast.InterfaceType:
						r.Text = "type " + ts.Name.Name + " interface"
					default:
						r.Text = "type " + r.Text
					}
					types = append(types, r)
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	// Per package: types first, then funcs, each in file order.
	rows := append(types, funcs...)
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].Pkg < rows[j].Pkg })
	return &Out{Root: root, Rows: rows}, nil
}

func row(fset *token.FileSet, pkg, kind string, node ast.Node) Row {
	var b strings.Builder
	printer.Fprint(&b, fset, node)
	pos := fset.Position(node.Pos())
	return Row{Pkg: pkg, Kind: kind, Text: strings.Join(strings.Fields(b.String()), " "), File: pos.Filename, Line: pos.Line}
}
