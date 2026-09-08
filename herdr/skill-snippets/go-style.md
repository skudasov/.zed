# Go: code style
- Write simple, readable Go. Prefer the standard library; reach for a framework only when stdlib clearly won't do.
- No comments inside code: no inline, no function or type comments.
- Only a short module-level doc comment at the top of each file describing what it does.
- Short but self-explanatory names: ctx, err, w, r, n, cfg, src, dst. Abbreviate only when the meaning is obvious.
- Export only what callers need (ErrX, NewX, ParseX); keep everything else lowercase.
- A CLI or binary may ship one short README.md on usage; libraries ship no docs.