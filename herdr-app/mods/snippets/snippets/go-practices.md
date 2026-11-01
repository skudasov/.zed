# Go: good practices
- Package names are lowercase, short, and single-word; the name is the package's first doc line.
- Build with constructors: NewX(...); use functional options (WithTimeout, WithRetries) when config grows past a few fields.
- defer cleanup right after acquiring: defer resp.Body.Close(), defer mu.Unlock().
- Keep functions small and pass dependencies explicitly; avoid global state and init().
- Make types useful at their zero value where natural (bytes.Buffer, sync.Mutex).
- Test with table-driven stdlib testing; run tests with -race.