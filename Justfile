install: install-flux9s install-configs install-lazydocker install-k9s install-herdr-plus
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    hs -c "hs.reload()"

install-lazydocker:
    brew install jesseduffield/lazydocker/lazydocker

install-tuicr:
    brew install tuicr

install-k9s:
    brew install k9s

install-flux9s:
    brew install dgunzy/tap/flux9s

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
	@echo "Installed herdr config to ~/.config/herdr/config.toml"
	@echo "Installed herdr scripts to ~/.config/herdr/bin/"
	@echo "Installed skill snippets to ~/.config/herdr/skill-snippets/"
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