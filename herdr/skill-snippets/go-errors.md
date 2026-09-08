# Go: error handling
- Prefer hoisting distinct error message strings on top of the file
- Always check errors; never discard with `_`.
- Wrap with context: fmt.Errorf("reading config: %w", err). Keep `%w` so callers can use errors.Is / errors.As.
- Return errors up the call chain; handle once at the edge and log the full chain.
- Sentinel errors for expected conditions: var ErrNotFound = errors.New("not found"), checked with errors.Is.
- panic only for programmer bugs; use Fatal (zerolog library) in main for startup failures.
- Never match on error strings.