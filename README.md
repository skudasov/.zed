## Install

Copy files to `~/.config/zed`

## Hammerspoon (OS X automation)

```bash
brew install --cask hammerspoon
just install
```

Enable `Hammerspoon` to access window API.
**System Settings → Privacy & Security → Accessibility → Hammerspoon**

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

## Session transcripts

[herdr-transcripts](https://github.com/hxreborn/herdr-transcripts) is an `fzf`
picker over every Claude Code and Codex session on the machine, searchable by
title, prompt, reply or tool call. `Enter` resumes a session in its own
directory, or focuses its pane when it is already running.

```bash
just install-herdr-transcripts
```

`prefix+f` opens the picker (bound in `herdr/config.toml`). The keybind uses
`$HERDR_BIN_PATH`, which `just install-configs` rewrites to the absolute herdr
path for the same reason the `herdr/bin` shebangs are rewritten: herdr runs
`[[keys.command]]` detached and expands nothing itself.

The plugin keeps its index in `~/.cache/herdr-transcripts` and its picker state
(scope, sort, filters, resume flags) in
`~/.config/herdr/plugins/config/transcripts/`, so this repo installs the plugin
and nothing else. `Ctrl+D` in the picker shows diagnostics, including Claude
Code's transcript retention — worth checking, since `cleanupPeriodDays`
defaults low enough to delete the sessions you would search for.

## Agent skills

`skills/manifest.txt` pins external agent skills by repo and git ref.
`just install-skills` clones each one and copies it into every harness that
reads a skills directory:

- `~/.claude/skills/<name>`
- `~/.config/opencode/skills/<name>`

A skill is portable markdown, so one source serves both. Installing replaces
the whole directory, so a file dropped upstream does not linger. Adding a skill
is one manifest line:

```text
# name        repo                ref        subdir
humanizer     blader/humanizer    v3.0.0     .
```

The ref is pinned on purpose: a skill is a prompt, and an unpinned prompt
changes under you.

[Humanizer](https://github.com/blader/humanizer) rewrites AI-sounding prose
against 25 patterns without changing the facts. Because it triggers off its
description rather than a slash command, plain language reaches it in any
harness — "humanize the prose in docs/launch-post.md" works in claude and
opencode alike. The **Humanize** quick action (`cmd+e`) sends that request to
the agent in the pane you launched from, for either a tracked prose file picked
with `fzf` or whatever is on the clipboard.

## gopls for agents

gopls has an MCP server built in (`gopls mcp`), which gives an agent the Go
tools an editor has: `go_search`, `go_symbol_references`, `go_diagnostics`,
`go_package_api`, `go_file_context`, `go_rename_symbol`, `go_vulncheck`,
`go_workspace`. The agent then uses symbol lookups instead of grepping.

```bash
just install-gopls
```

This pins gopls (`gopls_version` in the Justfile), registers it with Claude Code
at user scope (`~/.claude.json`), and runs `just install-harness-configs`, which
renders `opencode/opencode.jsonc` into `~/.config/opencode/`. Both harnesses get
the absolute path to `~/go/bin/gopls`, because an MCP server is started by the
harness, not by your shell, and `~/go/bin` is not on PATH. The server starts in
the session's cwd, so it serves whichever Go module you opened the agent in.
Zed runs its own copy of gopls and is not affected.

Check with `claude mcp list` and `opencode mcp list`.

## ponytail

[ponytail](https://github.com/DietrichGebert/ponytail) makes the agent write the
least code that works: check whether it needs to exist, then the codebase, the
stdlib, the platform, installed dependencies, and only then write something.
It adds `/ponytail` commands (`-audit`, `-review`, `-debt`, `-gain`) and injects
its rules each turn.

```bash
just install-ponytail
```

`ponytail_version` in the Justfile pins both harnesses to the same release:
Claude Code gets the plugin from a marketplace added at that git tag, opencode
gets the npm package of that version through `opencode/opencode.jsonc`. To
upgrade, bump the variable and rerun. Check with `claude plugin list` and
`opencode debug config`.

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