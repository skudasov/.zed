{
  description = "Hello World Python program";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.default = pkgs.writeScriptBin "hello" ''
          #!${pkgs.python3}/bin/python3
          ${builtins.readFile ./program.py}
        '';

        apps.default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/hello";
        };

        devShells.default = pkgs.mkShell {
          packages = [ pkgs.python3 ];
        };
      }
    );
}
