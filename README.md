## Install

Copy files to `~/.config/zed`

Use "Material Simple Dark Grey" for Chrome.

## Setting up project tasks and debug

Create a directory `.zed/` with `tasks.json` and `debug.json` and copy examples for `Go` and `Python`

## Linking Hammerspoon Keys

Enable `Hammerspoon` to access window API.
**System Settings → Privacy & Security → Accessibility → Hammerspoon**

```bash
brew install --cask hammerspoon
just install
```

## Linux VM

Just use `OrbStack` to create `Nix` VM, choose unstable.

```bash
orb create -a arm64 nixos:unstable nix
# apply configuration, OrbStack has hardware configs generated including incus.nix and hardware.nix, they may change so '--impure' is fine in this case
ssh nix@orb
sudo nixos-rebuild switch --flake --impure
```

Use `Ctrl+Option+O` to select default SSH: `orb`.
