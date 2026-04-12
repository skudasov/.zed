install:
    mkdir -p ~/.hammerspoon
    cp hammerspoon/init.lua ~/.hammerspoon/init.lua
    nix profile install nixpkgs#nil
    nix profile install nixpkgs#nixd

color:
    python3 colors.py

install-color: color
    mkdir -p ~/.config/ghostty/themes
    ln -sf $(PWD)/ghostty/config ~/.config/ghostty/config
    ln -sf $(PWD)/ghostty/themes/user-theme ~/.config/ghostty/themes/user-theme
    @echo "Ghostty config symlinked. Reload with Cmd+Shift+,"

install-hammerspoon:
	mkdir -p ~/.hammerspoon
	cp hammerspoon/init.lua ~/.hammerspoon/init.lua