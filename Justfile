install: install-sessions-viewer install-herdr install-lazydocker
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

install-herdr:
	mkdir -p ~/.config/herdr
	cp herdr/config.toml.example ~/.config/herdr/config.toml
	@echo "Installed herdr config to ~/.config/herdr/config.toml"
	@command -v herdr >/dev/null && herdr server reload-config 2>/dev/null || true

install-ghostty:
	mkdir -p ~/.config/ghostty
	cp ghostty/config ~/.config/ghostty/config
	@echo "Installed Ghostty config to ~/.config/ghostty/config"
	@echo "Restart Ghostty (full quit) for the cmd+y keybind to take effect."

install-pi:
	cp -R .pi/. ~/.pi/
	cd ~/.pi/extensions && pnpm i && cd -
	@echo "Installed Pi config to ~/.pi"

# --- Remote herdr over Tailscale ---------------------------------------

# Install the Tailscale CLI + start the system daemon (macOS, Homebrew).
install-tailscale:
	command -v tailscale >/dev/null || brew install tailscale
	sudo tailscaled install-system-daemon
	@echo "tailscaled running. Next: 'just tailscale-host' on this machine."

# HERDR HOST: join the tailnet + enable Tailscale SSH. No tags, no ACL edit.
# Default tailnet policy already allows SSH to your own devices.
# Run this on the machine that will RUN the herdr session.
tailscale-host:
	sudo tailscale up --ssh
	tailscale status

# OPTIONAL / advanced: push tailscale/acl.json via API instead of the web UI.
# Needs an API key: https://login.tailscale.com/admin/settings/keys
# Usage: TS_API_KEY=tskey-api-... just tailscale-acl-push
tailscale-acl-push:
	curl -fsS -u "${TS_API_KEY}:" -H "Content-Type: application/json" \
		--data-binary @tailscale/acl.json \
		"https://api.tailscale.com/api/v2/tailnet/-/acl" \
		&& echo "\nACL pushed."

# CLIENT: join the tailnet from the machine you connect FROM.
tailscale-client:
	sudo tailscale up
	tailscale status

# HERDR HOST: start (or reattach) a named persistent herdr session.
# Usage: just herdr-host-session            -> session "work"
#        just herdr-host-session name=dev   -> session "dev"
herdr-host-session name="work":
	herdr --session {{name}}

# CLIENT: attach to the host's herdr session over SSH (via Tailscale).
# Usage: just herdr-connect target=skudasov@herdr-host
#        just herdr-connect target=skudasov@herdr-host name=dev
herdr-connect target name="work":
	herdr --remote {{target}} --session {{name}}
