## Install

Copy files to `~/.config/zed`

## Linking Hammerspoon Keys

Enable `Hammerspoon` to access window API.
**System Settings → Privacy & Security → Accessibility → Hammerspoon**

```bash
brew install --cask hammerspoon
just install
```

## Semgrep rules

`semgrep/` holds one rule file per language — `go.yml` today — plus the fixtures
that test them. The `Review: semgrep` quick action passes the whole installed
directory to `--config`, so a rule only ever runs against the languages it
declares and adding a language needs no wiring:

1. write `semgrep/<lang>.yml`
2. write `semgrep/tests/<lang>.<ext>`, marking each case with a `// ruleid: <id>`
   or `// ok: <id>` comment on the line above it
3. `just test-semgrep`, then `just install-semgrep-rules`

Semgrep pairs a rule file with the fixture of the same basename, so the names
have to match. A rule scoped to test files (`paths.include: "*_test.*"`) falls
outside that pairing and is checked by a separate scan in `just test-semgrep`.

The review scans the files the branch touched, not the repo: a whole-repo scan
reports everything that was already there, which buries the branch's own bugs.
Use `semgrep --config ~/.config/semgrep --baseline-commit <ref> .` for a
whole-repo scan that still only reports what the branch introduced.

## Setting up project tasks and debug

Create a directory `.zed/` with `tasks.json` and `debug.json` and copy examples for `Go` and `Python`

## Chrome theme

`chrome-theme/` is a theme extension whose colors match Zed's "Ultimate Dark Neo"
and Ghostty: background `#303135`, active tab / toolbar `#3c464d`, text `#fff9ec`.
It repaints the tab strip, toolbar, bookmarks bar and New Tab Page only — web
pages and `chrome://` pages are untouched.

```bash
just install-chrome-theme
```

Then, once:

1. `chrome://extensions` -> Developer mode on
2. **Load unpacked**, `cmd+shift+g` in the picker, paste `~/.config/zed/chrome-theme`
   (`cmd+shift+.` also toggles hidden dirs in any macOS file dialog)

Chrome re-loads it on every start, so this is a one-time step. After editing
`chrome-theme/manifest.json`, hit the reload arrow on the extension card.

Chrome will not sideload a packed `.crx` on macOS and the `ExtensionSettings`
policy requires a Web Store `update_url`, so "Load unpacked" is the only way to
install this without publishing it.