{ pkgs, ... }: {
  home.username = "fahrenheit";
  home.homeDirectory = "/Users/fahrenheit";
  home.stateVersion = "25.05";

  home.packages = with pkgs; [
    # add packages here, e.g.:
    # ripgrep
    # fd
    # jq
  ];

  programs.home-manager.enable = true;
}
