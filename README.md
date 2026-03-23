## Install

Copy files to `~/.config/zed`

## Television Search

```
brew install television
tv update-channels
```

Create a file in `~/.config/television/cable/files.toml`

```
[metadata]
name = "files"
description = "A channel to select files and directories"
requirements = ["fd", "bat"]

[source]
command = "fd -t f"

[preview]
command = "bat -n --color=always '{}'"
env = { BAT_THEME = "Catppuccin Mocha" }

[ui]
preview_panel = { "size" = 70, "scrollbar" = true }

[keybindings]
shortcut = "f1"
f12 = "actions:edit"
f11 = ["actions:rm", "reload_source"]

[actions.edit]
description = "Opens the selected entries with the default editor (falls back to vim)"
command = "${EDITOR:-vim} {}"
mode = "execute"

[actions.rm]
description = "Removes the selected entries"
command = "rm {}"
```

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
# apply configuration
sudo nixos-rebuild switch --flake flake.nix
```

Use `Ctrl+Option+O` to select default SSH: `orb`.
