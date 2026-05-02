install:
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    nix profile install nixpkgs#nil
    nix profile install nixpkgs#nixd

install-hammerspoon:
	mkdir -p ~/.hammerspoon
	cp hammerspoon/init.lua ~/.hammerspoon/init.lua

install-pi:
	cp -R .pi/. ~/.pi/
	cd ~/.pi/extensions && pnpm i && cd -
	@echo "Installed Pi config to ~/.pi"