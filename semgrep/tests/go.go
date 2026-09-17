package fixture

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

var ErrNotFound = errors.New("not found")

// ruleid: go-context-background
var bad = context.Background()

func ok(ctx context.Context) error { return nil }

// ruleid: go-context-in-struct
type Server struct {
	ctx  context.Context
	name string
}

// ok: go-context-in-struct
type Good struct {
	name string
}

// ruleid: go-context-not-first-param
func lateCtx(name string, ctx context.Context) error { return nil }

// ok: go-context-not-first-param
func firstCtx(ctx context.Context, name string) error { return nil }

func wrap(err error) error {
	// ruleid: go-errorf-without-wrap
	return fmt.Errorf("reading config: %v", err)
}

func wrapOK(err error) error {
	// ok: go-errorf-without-wrap
	return fmt.Errorf("reading config: %w", err)
}

func match(err error) bool {
	// ruleid: go-error-string-match
	if err.Error() == "not found" {
		return true
	}
	// ruleid: go-error-string-match
	if strings.Contains(err.Error(), "timeout") {
		return true
	}
	// ok: go-error-string-match
	return errors.Is(err, ErrNotFound)
}

func loop(paths []string) error {
	for _, p := range paths {
		f, err := open(p)
		if err != nil {
			return err
		}
		// ruleid: go-defer-in-loop
		defer f.Close()
	}
	return nil
}

func loopOK(paths []string) error {
	for _, p := range paths {
		if err := func() error {
			f, err := open(p)
			if err != nil {
				return err
			}
			// ok: go-defer-in-loop
			defer f.Close()
			return nil
		}(); err != nil {
			return err
		}
	}
	return nil
}

// ruleid: go-mutex-by-value
func guard(mu sync.Mutex, n int) {}

// ok: go-mutex-by-value
func guardOK(mu *sync.Mutex, n int) {}

func ticker(ctx context.Context, work chan int) {
	for {
		select {
		case <-work:
		// ruleid: go-time-after-in-select-loop
		case <-time.After(time.Second):
			return
		}
	}
}

func tickerOK(ctx context.Context, work chan int) {
	t := time.NewTimer(time.Second)
	defer t.Stop()
	for {
		select {
		case <-work:
			t.Reset(time.Second)
		// ok: go-time-after-in-select-loop
		case <-t.C:
			return
		}
	}
}

// ruleid: go-http-client-without-timeout
var client = &http.Client{}

// ok: go-http-client-without-timeout
var clientOK = &http.Client{Timeout: 10 * time.Second}

func fetch(url string) error {
	// ruleid: go-http-default-client
	_, err := http.Get(url)
	return err
}

func report(n int) {
	// ruleid: go-stdlib-print-logging
	fmt.Printf("done: %d\n", n)
}

// ruleid: go-init-func
func init() {}

func open(p string) (*fakeFile, error) { return nil, nil }

type fakeFile struct{}

func (f *fakeFile) Close() error { return nil }
