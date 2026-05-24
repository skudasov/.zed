install: install-sessions-viewer
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    hs -c "hs.reload()"

install-sessions-viewer:
    rsync -a --delete --exclude=node_modules --exclude=.svelte-kit viewer/ ~/.claude/projects/viewer/
    cd ~/.claude/projects/viewer && pnpm install

sessions:
    cd viewer && pnpm run dev

install-pi:
	cp -R .pi/. ~/.pi/
	cd ~/.pi/extensions && pnpm i && cd -
	@echo "Installed Pi config to ~/.pi"
