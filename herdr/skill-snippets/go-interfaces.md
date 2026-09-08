# Go: interfaces
- Accept the narrowest interface you need, return concrete types: func Do(r io.Reader) error; give callers real methods back.
- Define interfaces where they are consumed, not produced; the caller declares what it needs and concrete types just satisfy it.
- Keep interfaces small (one to three methods); prefer composing io.Reader / io.Writer over one fat interface.
- Add an interface only for a second implementation or a test fake; a concrete type is the default.
- Prefer type parameters over any with type switches; use any only when no generics fit.