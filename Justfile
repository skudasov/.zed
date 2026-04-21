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

install-pi:
	mkdir -p ~/.pi/agent/prompts ~/.pi/agent/extensions
	cp .pi/agent/AGENTS.md ~/.pi/agent/AGENTS.md
	cp .pi/agent/prompts/review.md ~/.pi/agent/prompts/review.md
	cp .pi/agent/prompts/fix.md ~/.pi/agent/prompts/fix.md
	cp .pi/agent/prompts/plan.md ~/.pi/agent/prompts/plan.md
	cp .pi/extensions/ ~/.pi/agent/extensions/
	@echo "Installed Pi agent config to ~/.pi/agent"