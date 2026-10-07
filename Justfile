[private]
default:
    @just --list

# Everything (except tuicr), configs before the recipes that build on them.
install: shell-env fonts hammerspoon harlequin lazydocker k9s flux9s sofka ocr semgrep semgrep-rules configs herdr-plus herdr-transcripts zoetrope diagrams lazyvim skills ponytail chrome-theme

# Hammerspoon config, reloaded in place.
hammerspoon:
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    hs -c "hs.reload()"

# ~/.zshenv is read by every zsh (login, interactive, scripts) and Zed loads the
# shell env, so one line reaches claude/opencode (Ctrl+g opens $EDITOR) anywhere.
# Appended only if missing: the rest of ~/.zshenv is machine-specific.
[doc("Set EDITOR=nvim in ~/.zshenv")]
shell-env:
    grep -qxF 'export EDITOR=nvim' ~/.zshenv 2>/dev/null || echo 'export EDITOR=nvim' >> ~/.zshenv

# JetBrains Mono is the font for Zed (buffer + UI) and Ghostty (and so herdr).
fonts:
    brew install --cask font-jetbrains-mono

# Installed with uv, not brew: the brew bottle's Python 3.14 needs a newer
# /usr/lib/libexpat than macOS 26.0 ships and crashes on start.
[doc("Harlequin SQL TUI, with Postgres support")]
harlequin:
    uv tool install --force --python 3.13 'harlequin[postgres]'

# Docker TUI.
lazydocker:
    brew install jesseduffield/lazydocker/lazydocker

# Code review TUI (not part of `install`).
tuicr:
    brew install tuicr

# OpenCodeReview (`ocr`), used by the "Review: OCR" quick action.
# Delegate mode runs no LLM itself, so no provider or API key needs configuring.
[doc("OpenCodeReview, for the Review: OCR quick action")]
ocr:
    npm install -g @alibaba-group/open-code-review

# Pattern matcher behind the "Review: semgrep" quick action; rules in semgrep/.
semgrep:
    brew install semgrep

# Install the rules; the tests/ fixtures next to them stay in the repo.
# They belong to no one tool — anything can point --config at the installed
# directory — so they do not live under ~/.config/herdr with the review wiring.
[doc("Copy semgrep rules to ~/.config/semgrep")]
semgrep-rules:
    mkdir -p ~/.config/semgrep
    rm -f ~/.config/semgrep/*.yml
    cp semgrep/*.yml ~/.config/semgrep/
    @echo "Installed semgrep rules to ~/.config/semgrep/"

# Run each language's rules against their ruleid:/ok: fixtures in semgrep/tests/.
# The test-only rule sits outside semgrep's file pairing, so it gets its own scan.
[doc("Test semgrep rules against their fixtures")]
test-semgrep:
    #!/usr/bin/env bash
    set -euo pipefail
    cd semgrep
    semgrep --config . --validate
    semgrep --test --config . tests
    # A rule with paths.include: "*_test.*" never matches the fixture semgrep
    # pairs with its rule file, so those fixtures get a plain scan instead.
    semgrep --config . --quiet --error tests/*_test.* >/dev/null \
      && { echo "test-only rules did not fire"; exit 1; } || echo "test-only rules ✓"

# Kubernetes TUI.
k9s:
    brew install k9s

# ponytail (github.com/DietrichGebert/ponytail) — "lazy senior dev" ruleset:
# YAGNI, stdlib first, no unrequested abstractions. Claude gets it as a plugin
# from a marketplace pinned to the tag; opencode as the npm package of the same
# version, via harness-configs. One version for both, bumped here.
ponytail_version := "4.10.0"

# Install the ponytail plugin for Claude, then harness configs for opencode.
ponytail:
    #!/usr/bin/env bash
    set -euo pipefail
    # The marketplace is pinned to a tag, so a bump means re-adding it; removing
    # it uninstalls the plugin, which the install below puts back.
    claude plugin marketplace remove ponytail >/dev/null 2>&1 || true
    claude plugin marketplace add "https://github.com/DietrichGebert/ponytail.git#v{{ponytail_version}}"
    claude plugin install ponytail@ponytail
    just harness-configs

# Agent harness configs that are not skills. opencode/cli.json is copied as is;
# opencode/opencode.jsonc carries __PLACEHOLDER__ tokens for machine-specific
# values, filled in here.
[doc("Copy opencode config and TUI settings into place")]
harness-configs:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p ~/.config/opencode
    sed -e "s|__PONYTAIL_VERSION__|{{ponytail_version}}|g" \
        opencode/opencode.jsonc > ~/.config/opencode/opencode.jsonc
    echo "Installed opencode config to ~/.config/opencode/opencode.jsonc"
    # TUI settings (what /settings edits). Copied whole, so a /settings change
    # made on one machine is lost on the next install unless it lands here too.
    cp opencode/cli.json ~/.config/opencode/cli.json
    echo "Installed opencode TUI settings to ~/.config/opencode/cli.json"
    # cli.json's "plugins" loads them by path from ~/.config/opencode/plugins/,
    # so the plugin files install with the config that references them.
    just opencode-plugins

# OpenCode TUI plugins, one directory per plugin under opencode/plugins/,
# laid out like a published package (package.json + tui.tsx) and referenced
# by name from cli.json's "plugins". Copied (never symlinked) whole-directory
# into ~/.config/opencode/plugins/, which herdr also manages files in: only
# directories named here are touched, herdr's loose files are left alone.
[doc("Copy opencode TUI plugins into place")]
opencode-plugins:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p ~/.config/opencode/plugins
    for src in opencode/plugins/*/; do
        name="$(basename "$src")"
        rm -rf ~/.config/opencode/plugins/"$name"
        cp -R "${src%/}" ~/.config/opencode/plugins/"$name"
        echo "Installed OpenCode plugin $name to ~/.config/opencode/plugins/$name"
    done

# zoetrope (github.com/furkankly/zoetrope) — draws a Claude Code or Codex
# session as a live flow graph of agents, subagents and tool calls. Binary is
# `zoe`; herdr/bin/zoe.ts opens it in a "zoe" tab (prefix+a, or quick actions).
[doc("zoetrope: live graph of an agent session")]
zoetrope:
    brew install furkankly/tap/zoetrope

# d2 (d2lang.com) compiles a text diagram source to PNG/SVG, and timg draws that
# image in the terminal with the kitty graphics protocol Ghostty speaks — so a
# diagram shows up as a real image, not block-character art. Wired together by
# herdr/bin/diagram.ts, bound to prefix+d and driven by the `diagram` skill.
[doc("d2, timg and terminal-browser for terminal diagrams")]
diagrams:
    #!/usr/bin/env bash
    set -euo pipefail
    brew install d2 timg neovim
    # terminal-browser (github.com/zenbu-labs/terminal-browser) is a real browser
    # in a terminal pane — the live preview half of the "Diagram: new" workbench.
    # Its own installer puts it under ~/.local, so an existing copy is left alone
    # rather than ending up with two of them on PATH.
    if command -v terminal-browser >/dev/null; then
    	echo "$(terminal-browser --version) already installed"
    else
    	brew install terminal-browser
    fi

# LazyVim (github.com/LazyVim/LazyVim) — the editor half of the diagram
# workbench, and a usable Neovim everywhere else. Installed from the upstream
# starter, which is a template and not a dependency: its .git is dropped so
# ~/.config/nvim is yours to edit. An existing config is left alone.
[doc("LazyVim starter config, plugins synced")]
lazyvim:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v nvim >/dev/null || brew install neovim
    if [ -d ~/.config/nvim ]; then
    	echo "~/.config/nvim already exists, leaving it alone"
    else
    	git clone --depth 1 https://github.com/LazyVim/starter ~/.config/nvim
    	rm -rf ~/.config/nvim/.git
    	echo "Installed LazyVim starter to ~/.config/nvim"
    fi
    just configs >/dev/null
    # Plugins are fetched on first start otherwise, which means the diagram
    # workbench's first launch is spent watching a package manager.
    nvim --headless "+Lazy! sync" +qa 2>&1 | tail -3 || true
    echo "LazyVim ready"

# Flux CD TUI in the style of k9s.
flux9s:
    brew install dgunzy/tap/flux9s

# Kubernetes TUI (kube-rs + ratatui), with Flux CD and Argo CD support.
sofka:
    brew install nklmilojevic/sofka/sofka

# Copy (never symlink) the herdr + Ghostty configs into place.
# rm -f first: cp through an existing symlink would write back into this repo
# instead of replacing the link with a real file.
[doc("Copy herdr, Ghostty and nvim configs into place")]
configs:
    mkdir -p ~/.config/herdr ~/.config/ghostty
    rm -f ~/.config/herdr/config.toml ~/.config/ghostty/config
    # Expand ~ in script paths: herdr may hand [[keys.command]] straight to
    # execve, which would not expand it. The repo keeps ~ so it stays portable.
    # $HERDR_BIN_PATH is the path herdr-transcripts documents for its keybind;
    # resolve it here for the same reason, falling back to a bare `herdr` when
    # the binary is not installed yet.
    sed -e "s|~/.config/herdr/bin/|$HOME/.config/herdr/bin/|g" \
        -e "s|\$HERDR_BIN_PATH|$(command -v herdr || echo herdr)|g" \
        herdr/config.toml > ~/.config/herdr/config.toml
    cp ghostty/config ~/.config/ghostty/config
    # The scripts run under bun. The repo keeps `#!/usr/bin/env bun` so it stays
    # portable; the installed copies get an absolute shebang, because herdr runs
    # [[keys.command]] detached and its PATH may not include ~/.bun/bin.
    mkdir -p ~/.config/herdr/bin
    rm -f ~/.config/herdr/bin/*.ts
    cp herdr/bin/*.ts ~/.config/herdr/bin/
    sed -i '' "1s|#!/usr/bin/env bun|#!$(command -v bun)|" ~/.config/herdr/bin/*.ts
    chmod +x ~/.config/herdr/bin/*.ts
    # The repo's slice of the Neovim config: LazyVim reads lua/config/*.lua after
    # its own defaults, so these files only add to it. They are copied rather
    # than merged, so anything hand-edited there is replaced — put your own
    # settings in lua/plugins/ instead, which this never touches.
    if [ -d ~/.config/nvim/lua/config ]; then \
    	cp herdr/nvim/lua/config/*.lua ~/.config/nvim/lua/config/; \
    	echo "Installed nvim config to ~/.config/nvim/lua/config/"; \
    else \
    	echo "No ~/.config/nvim yet — run \`just lazyvim\`"; \
    fi
    mkdir -p ~/.config/herdr/skill-snippets
    rm -f ~/.config/herdr/skill-snippets/*
    cp herdr/skill-snippets/*.md ~/.config/herdr/skill-snippets/
    mkdir -p ~/.config/herdr/review-prompts
    rm -f ~/.config/herdr/review-prompts/* ~/.config/herdr/review.toml
    cp herdr/review-prompts/*.md ~/.config/herdr/review-prompts/
    cp herdr/review.toml ~/.config/herdr/review.toml
    @echo "Installed herdr config to ~/.config/herdr/config.toml"
    @echo "Installed herdr scripts to ~/.config/herdr/bin/"
    @echo "Installed skill snippets to ~/.config/herdr/skill-snippets/"
    @echo "Installed review prompts + review.toml to ~/.config/herdr/"
    @echo "Installed Ghostty config to ~/.config/ghostty/config"
    @command -v herdr >/dev/null && herdr server reload-config 2>/dev/null || true
    @echo "Reload Ghostty config (cmd+shift+,) for keybind changes to take effect."

# Install the herdr-plus plugin and push this repo's plugin config into the
# plugin's managed config dir. Repo is the source of truth: rsync --delete
# means anything added directly under the managed dir is removed on install.
[doc("herdr-plus plugin plus this repo's config for it")]
herdr-plus:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v herdr >/dev/null || { echo "herdr not on PATH"; exit 1; }
    if ! herdr plugin list --json 2>/dev/null | grep -q 'cloudmanic.herdr-plus'; then
    	herdr plugin install cloudmanic/herdr-plus --yes
    fi
    dir="$(herdr plugin config-dir cloudmanic.herdr-plus 2>/dev/null || true)"
    dir="${dir:-$HOME/.config/herdr/plugins/config/cloudmanic.herdr-plus}"
    mkdir -p "$dir"
    rsync -a --delete --exclude=.gitkeep herdr/plus/ "$dir/"
    echo "Installed herdr-plus config to $dir"
    herdr server reload-config 2>/dev/null || true

# herdr-transcripts (github.com/hxreborn/herdr-transcripts) — fzf over every
# Claude Code and Codex session, bound to prefix+f in herdr/config.toml. The
# plugin keeps its own index in ~/.cache/herdr-transcripts and its own picker
# state in the plugin config dir, so there is nothing for this repo to install
# besides the plugin itself.
[doc("herdr-transcripts: fzf picker over agent sessions")]
herdr-transcripts:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v herdr >/dev/null || { echo "herdr not on PATH"; exit 1; }
    command -v fzf >/dev/null || brew install fzf
    if ! herdr plugin list --json 2>/dev/null | grep -q 'herdr-transcripts\|\.transcripts'; then
    	herdr plugin install hxreborn/herdr-transcripts --yes
    fi
    herdr server reload-config 2>/dev/null || true
    echo "Installed herdr-transcripts; prefix+f opens the picker"

# External agent skills, from skills/manifest.txt into every harness that reads
# a skills directory. A skill is portable markdown, so the same file serves
# claude and opencode — installing it twice is cheaper than teaching one harness
# to read the other's directory. The manifest pins a ref per skill; installing
# replaces the whole directory, so upstream removals do not linger.
[doc("Agent skills into claude and opencode")]
skills:
    #!/usr/bin/env bash
    set -euo pipefail
    targets=("$HOME/.claude/skills" "$HOME/.config/opencode/skills")
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    while read -r name repo ref subdir _rest; do
    	case "${name:-}" in ''|'#'*) continue;; esac
    	git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$ref" "https://github.com/$repo" "$tmp/$name"
    	src="$tmp/$name/${subdir:-.}"
    	[ -f "$src/SKILL.md" ] || { echo "skills: no SKILL.md in $repo@$ref/${subdir:-.}"; exit 1; }
    	for dir in "${targets[@]}"; do
    		mkdir -p "$dir"
    		rm -rf "${dir:?}/$name"
    		# Everything the skill itself needs, none of the repo's packaging.
    		rsync -a --exclude=.git --exclude=.github --exclude=.claude-plugin \
    		      --exclude=assets --exclude=tests "$src/" "$dir/$name/"
    		echo "Installed skill $name ($repo@$ref) to $dir/$name"
    	done
    done < skills/manifest.txt
    # Skills written here rather than vendored: a directory under skills/ with a
    # SKILL.md, installed the same way and into the same places, so an agent
    # cannot tell which of its skills came from where.
    for src in skills/*/; do
    	name="$(basename "$src")"
    	[ -f "$src/SKILL.md" ] || continue
    	for dir in "${targets[@]}"; do
    		mkdir -p "$dir"
    		rm -rf "${dir:?}/$name"
    		rsync -a "$src" "$dir/$name/"
    		echo "Installed skill $name (local) to $dir/$name"
    	done
    done

# Chrome theme matching Zed "Ultimate Dark Neo" + Ghostty (background #303135).
# Chrome cannot sideload a local .crx on macOS (an ExtensionSettings policy
# update_url must point at the Web Store), so this stays a "Load unpacked"
# extension. Loading it once is permanent: Chrome re-loads it on every start.
# The copy is a no-op when the repo already sits at ~/.config/zed.
[doc("Chrome theme matching Zed and Ghostty")]
chrome-theme:
    #!/usr/bin/env bash
    set -euo pipefail
    dest="$HOME/.config/zed/chrome-theme"
    if [ "$(pwd)/chrome-theme" != "$dest" ]; then
    	mkdir -p "$dest"
    	cp chrome-theme/manifest.json "$dest/manifest.json"
    fi
    echo "Chrome theme ready at $dest"
    echo "  1. open chrome://extensions and turn Developer mode on"
    echo "  2. Load unpacked -> cmd+shift+g in the picker, paste: $dest"
    echo "  (cmd+shift+. also toggles hidden dirs in any macOS file dialog)"
    echo "  Already loaded? Just hit the reload arrow on the card."
