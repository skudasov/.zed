install: install-fonts install-flux9s install-configs install-lazydocker install-k9s install-sofka install-ocr install-semgrep install-semgrep-rules install-herdr-plus install-chrome-theme
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    hs -c "hs.reload()"

# JetBrains Mono is the font for Zed (buffer + UI) and Ghostty (and so herdr).
install-fonts:
    brew install --cask font-jetbrains-mono

install-lazydocker:
    brew install jesseduffield/lazydocker/lazydocker

install-tuicr:
    brew install tuicr

# Delegate mode runs no LLM itself, so no provider or API key needs configuring.
# OpenCodeReview (`ocr`), used by the "Review: OCR" quick action.
install-ocr:
    npm install -g @alibaba-group/open-code-review

# Pattern matcher behind the "Review: semgrep" quick action; rules in semgrep/.
install-semgrep:
    brew install semgrep

# They belong to no one tool — anything can point --config at the installed
# directory — so they do not live under ~/.config/herdr with the review wiring.
# Install the rules; the tests/ fixtures next to them stay in the repo.
install-semgrep-rules:
    mkdir -p ~/.config/semgrep
    rm -f ~/.config/semgrep/*.yml
    cp semgrep/*.yml ~/.config/semgrep/
    @echo "Installed semgrep rules to ~/.config/semgrep/"

# The test-only rule sits outside semgrep's file pairing, so it gets its own scan.
# Run each language's rules against their ruleid:/ok: fixtures in semgrep/tests/.
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

install-k9s:
    brew install k9s

install-flux9s:
    brew install dgunzy/tap/flux9s

# Kubernetes TUI (kube-rs + ratatui), with Flux CD and Argo CD support.
install-sofka:
    brew install nklmilojevic/sofka/sofka

# Copy (never symlink) the herdr + Ghostty configs into place.
# rm -f first: cp through an existing symlink would write back into this repo
# instead of replacing the link with a real file.
install-configs:
	mkdir -p ~/.config/herdr ~/.config/ghostty
	rm -f ~/.config/herdr/config.toml ~/.config/ghostty/config
	# Expand ~ in script paths: herdr may hand [[keys.command]] straight to
	# execve, which would not expand it. The repo keeps ~ so it stays portable.
	sed "s|~/.config/herdr/bin/|$HOME/.config/herdr/bin/|g" herdr/config.toml > ~/.config/herdr/config.toml
	cp ghostty/config ~/.config/ghostty/config
	# The scripts run under bun. The repo keeps `#!/usr/bin/env bun` so it stays
	# portable; the installed copies get an absolute shebang, because herdr runs
	# [[keys.command]] detached and its PATH may not include ~/.bun/bin.
	mkdir -p ~/.config/herdr/bin
	rm -f ~/.config/herdr/bin/*.ts
	cp herdr/bin/*.ts ~/.config/herdr/bin/
	sed -i '' "1s|#!/usr/bin/env bun|#!$(command -v bun)|" ~/.config/herdr/bin/*.ts
	chmod +x ~/.config/herdr/bin/*.ts
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
install-herdr-plus:
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

install-pi:
	cp -R .pi/. ~/.pi/
	cd ~/.pi/extensions && pnpm i && cd -
	@echo "Installed Pi config to ~/.pi"

# Chrome cannot sideload a local .crx on macOS (an ExtensionSettings policy
# update_url must point at the Web Store), so this stays a "Load unpacked"
# extension. Loading it once is permanent: Chrome re-loads it on every start.
# The copy is a no-op when the repo already sits at ~/.config/zed.
# Chrome theme matching Zed "Ultimate Dark Neo" + Ghostty (background #303135).
install-chrome-theme:
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
