## Install

Copy files to `~/.config/zed`

## Chrome theme

`chrome-theme/` is a theme extension whose colors match Zed's "Ultimate Dark Neo"
and Ghostty: background `#303135`, active tab / toolbar `#3c464d`, text `#fff9ec`.
It repaints the tab strip, toolbar, bookmarks bar and New Tab Page only — web
pages and `chrome://` pages are untouched.

```bash
just install-chrome-theme
```

Then, once:

1. `chrome://extensions` -> Developer mode on
2. **Load unpacked**, `cmd+shift+g` in the picker, paste `~/.config/zed/chrome-theme`
   (`cmd+shift+.` also toggles hidden dirs in any macOS file dialog)

Chrome re-loads it on every start, so this is a one-time step. After editing
`chrome-theme/manifest.json`, hit the reload arrow on the extension card.

Chrome will not sideload a packed `.crx` on macOS and the `ExtensionSettings`
policy requires a Web Store `update_url`, so "Load unpacked" is the only way to
install this without publishing it.

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
