install: install-sessions-viewer install-herdr
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    hs -c "hs.reload()"

install-sessions-viewer:
    rsync -a --delete --exclude=node_modules --exclude=.svelte-kit viewer/ ~/.claude/projects/viewer/
    cd ~/.claude/projects/viewer && pnpm install

sessions:
    cd viewer && pnpm run dev

install-herdr:
	mkdir -p ~/.config/herdr
	cp herdr/config.toml.example ~/.config/herdr/config.toml
	@echo "Installed herdr config to ~/.config/herdr/config.toml"
	@command -v herdr >/dev/null && herdr server reload-config 2>/dev/null || true

install-pi:
	cp -R .pi/. ~/.pi/
	cd ~/.pi/extensions && pnpm i && cd -
	@echo "Installed Pi config to ~/.pi"
