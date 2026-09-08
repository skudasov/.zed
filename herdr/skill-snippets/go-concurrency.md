# Go: concurrency
- Use sync.Mutex or sync.RWMutex to guard shared state; use channels to communicate and pass state between goroutines.
- Use atomic only when a non-blocking algorithm is essential.
- Launch parallel tasks with errgroup.WithContext(ctx); the group cancels the context on the first error and Wait returns it.
- Collect results from parallel tasks with a channel; when a channel does not fit the shape, use a slice guarded by a Mutex.
- Prefer RWMutex when reads far outnumber writes.
- Guard every field touched from more than one goroutine; a data race is a bug — run tests with -race.