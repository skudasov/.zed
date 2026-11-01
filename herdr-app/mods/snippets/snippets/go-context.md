# Go: context idioms
- Accept ctx as the first parameter, named ctx: func Do(ctx context.Context, ...) error.
- Pass ctx to every I/O, HTTP, and DB call so work can be cancelled.
- Derive cancellable/timeout contexts with context.WithTimeout / context.WithCancel at the edge; defer cancel().
- Check ctx.Err() before expensive work and return ctx.Err() when the context is done.
- Never store a context in a struct; pass it explicitly through calls.
- Use context.Background() only in tests and main.