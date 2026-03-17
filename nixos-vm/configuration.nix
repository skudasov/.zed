{ modulesPath, pkgs, ... }: {
  imports = [
    (modulesPath + "/profiles/qemu-guest.nix")
    ./hardware-configuration.nix
  ];

  services.openssh.enable = true;

  users.users.root.openssh.authorizedKeys.keys = [
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAdJWz1uvhoJS6QSeARRoDR+MFQE2w+Mgw+qVGdprXf+ f4hrenh9it@gmail.com"
  ];

  environment.systemPackages = [ pkgs.jq ];

  networking.hostName = "nixos-target";
  system.stateVersion = "25.05";
}
