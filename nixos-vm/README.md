# Guide to setup NixOS VM

1. Create a new `unstable` channel VM in OrbStack, name it `nixos`

2. Configure it

```bash
cd local
nix develop

nixos-rebuild switch --flake ..#nixos-target --target-host nixos@orb --use-remote-sudo
```
