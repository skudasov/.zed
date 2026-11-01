[private]
default:
    @just --list

# Everything (except tuicr), configs before the recipes that build on them.
install: shell-env fonts hammerspoon harlequin lazydocker k9s flux9s sofka ocr semgrep semgrep-rules configs herdr-app lazyvim skills ponytail chrome-theme

# Hammerspoon config, reloaded in place.
hammerspoon:
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    hs -c "hs.reload()"

# ~/.zshenv is read by every zsh (login, interactive, scripts) and Zed loads the
# shell env, so one line reaches claude/opencode (Ctrl+g opens $EDITOR) anywhere.
# Appended only if missing: the rest of ~/.zshenv is machine-specific.
#
# Caveat that ships with that line: zsh links its `main` keymap to `viins`
# whenever $VISUAL/$EDITOR contains the substring "vi" — and "nvim" does. That
# maps Ctrl+R to `redisplay` and Ctrl+P to `self-insert`, so reverse-history
# search dies in every terminal. ~/.zshrc gets `bindkey -e` to force the emacs
# keymap back; appended there too, idempotently.
[doc("Set EDITOR=nvim in ~/.zshenv, keep zsh's emacs keymap")]
shell-env:
    grep -qxF 'export EDITOR=nvim' ~/.zshenv 2>/dev/null || echo 'export EDITOR=nvim' >> ~/.zshenv
    grep -qxF 'bindkey -e' ~/.zshrc 2>/dev/null || printf '\n# zsh selects the viins keymap when $EDITOR contains "vi" (EDITOR=nvim above);\n# force emacs so Ctrl+R/Ctrl+P stay history search.\nbindkey -e\n' >> ~/.zshrc

# JetBrains Mono is the font for Zed (buffer + UI) and Ghostty (and the herdr app).
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

# OpenCodeReview (`ocr`).
# Delegate mode runs no LLM itself, so no provider or API key needs configuring.
[doc("OpenCodeReview")]
ocr:
    npm install -g @alibaba-group/open-code-review

# Pattern matcher; rules in semgrep/.
semgrep:
    brew install semgrep

# Install the rules; the tests/ fixtures next to them stay in the repo.
# They belong to no one tool — anything can point --config at the installed
# directory.
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

# LazyVim (github.com/LazyVim/LazyVim) — a usable Neovim. Installed from the upstream
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
    # Plugins are fetched on first start otherwise.
    nvim --headless "+Lazy! sync" +qa 2>&1 | tail -3 || true
    echo "LazyVim ready"

# Flux CD TUI in the style of k9s.
flux9s:
    brew install dgunzy/tap/flux9s

# Kubernetes TUI (kube-rs + ratatui), with Flux CD and Argo CD support.
sofka:
    brew install nklmilojevic/sofka/sofka

# Copy (never symlink) the Ghostty config into place. rm -f first: cp through an
# existing symlink would write back into this repo.
[doc("Copy the Ghostty config into place")]
configs:
    mkdir -p ~/.config/ghostty
    rm -f ~/.config/ghostty/config
    cp ghostty/config ~/.config/ghostty/config
    @echo "Installed Ghostty config to ~/.config/ghostty/config (reload: cmd+shift+,)"

# herdr-app (the official desktop app, home ~/.config/herdr-app): the Zed
# theme, the minimal "zed" layout, keys and mods.
# Installed to ~/Applications, where the existing copy lives. The app writes its default keys.json and
# settings.json on first start; the repo's fragments are merged over them, so
# the app's defaults and anything not set here survive (.bak kept per file).
[doc("herdr-app: install, Zed theme, minimal layout, keys, mods")]
herdr-app:
    #!/usr/bin/env bash
    set -euo pipefail
    home=~/.config/herdr-app
    [ -d ~/Applications/Herdr.app ] || brew install --cask --appdir="$HOME/Applications" herdr-app
    command -v jq >/dev/null || brew install jq
    if [ ! -f "$home/keys.json" ] || [ ! -f "$home/settings.json" ]; then
    	open ~/Applications/Herdr.app
    	for _ in $(seq 60); do [ -f "$home/keys.json" ] && [ -f "$home/settings.json" ] && break; sleep 1; done
    	[ -f "$home/keys.json" ] || { echo "herdr-app did not write $home/keys.json; start it once and re-run"; exit 1; }
    fi
    app=~/Applications/Herdr.app/Contents/MacOS/Herdr
    mkdir -p "$home/mods" "$home/themes" "$home/layouts"
    cp -R herdr-app/mods/ "$home/mods/"
    cp herdr-app/themes/*.json "$home/themes/"
    cp herdr-app/layouts/*.json "$home/layouts/"
    for f in keys settings; do
    	cp "$home/$f.json" "$home/$f.json.bak"
    	jq -s '.[0] * .[1]' "$home/$f.json.bak" "herdr-app/$f.json" > "$home/$f.json"
    done
    for m in herdr-app/mods/*/; do "$app" check "$home/mods/$(basename "$m")"; done
    "$app" do layout.switch '{"name":"zed"}' >/dev/null || echo "Open herdr-app, then: herdr-app do layout.switch '{\"name\":\"zed\"}'"
    echo "Installed herdr-app theme, layout, keys, settings and mods to $home"

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
