install: install-sessions-viewer install-configs install-lazydocker
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    hs -c "hs.reload()"

install-lazydocker:
    brew install jesseduffield/lazydocker/lazydocker

install-sessions-viewer:
    rsync -a --delete --exclude=node_modules --exclude=.svelte-kit viewer/ ~/.claude/projects/viewer/
    cd ~/.claude/projects/viewer && pnpm install

install-tuicr:
    brew install tuicr

sessions:
    cd viewer && pnpm run dev

# Copy (never symlink) the herdr + Ghostty configs into place.
# rm -f first: cp through an existing symlink would write back into this repo
# instead of replacing the link with a real file.
install-configs:
	mkdir -p ~/.config/herdr ~/.config/ghostty
	rm -f ~/.config/herdr/config.toml ~/.config/ghostty/config
	cp herdr/config.toml ~/.config/herdr/config.toml
	cp ghostty/config ~/.config/ghostty/config
	@echo "Installed herdr config to ~/.config/herdr/config.toml"
	@echo "Installed Ghostty config to ~/.config/ghostty/config"
	@command -v herdr >/dev/null && herdr server reload-config 2>/dev/null || true
	@echo "Reload Ghostty config (cmd+shift+,) for keybind changes to take effect."

install-pi:
	cp -R .pi/. ~/.pi/
	cd ~/.pi/extensions && pnpm i && cd -
	@echo "Installed Pi config to ~/.pi"