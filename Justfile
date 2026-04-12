install:
	mkdir -p ~/.hammerspoon
	cp hammerspoon/init.lua ~/.hammerspoon/init.lua
	nix profile install nixpkgs#nil
	nix profile install nixpkgs#nixd

install-ghostty:
	mkdir -p ~/.config/ghostty/themes
	ln -sf $(PWD)/ghostty/config ~/.config/ghostty/config
	ln -sf $(PWD)/ghostty/themes/github-dark-dimmed ~/.config/ghostty/themes/github-dark-dimmed
	ln -sf $(PWD)/ghostty/themes/one-light ~/.config/ghostty/themes/one-light
	@echo "Ghostty config symlinked. Reload with Cmd+Shift+,"
