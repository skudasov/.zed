install:
	mkdir -p ~/.hammerspoon
	cp hammerspoon/init.lua ~/.hammerspoon/init.lua
	nix profile install nixpkgs#nixd