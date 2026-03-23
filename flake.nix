{
  description = "Common dev shell for macOS machines";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
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
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Zig
            valgrind

            # JSON / data wrangling
            jq
            yq-go # yq for YAML, TOML, XML — same syntax as jq
            miller # mlr: CSV/JSON/TSV swiss army knife

            # Search & navigation
            fd # fast find replacement
            ripgrep # fast grep (rg)
            fzf # fuzzy finder
            bat # cat with syntax highlighting
            eza # modern ls (exa successor)
            zoxide # smarter cd (z)

            # HTTP
            curl
            httpie # http/https CLI client (http/https commands)

            # Database clients (CLI only, no server)
            postgresql # gives you psql
            redis # gives you redis-cli

            # Git extras
            gh # GitHub CLI
            delta # better git diff pager
            lazygit # TUI git client

            # Files & text
            tree
            sd # sed replacement (simpler syntax)
            choose # friendlier cut

            # Process / system
            htop
            procs # modern ps replacement
            bandwhich # network utilization by process

            # Dev utilities
            just # command runner (Justfile)
            direnv # per-directory env vars
            watchexec # run commands on file changes
            mkcert # local trusted TLS certs

            # Archives
            unzip
            p7zip
          ];

          shellHook = "";
        };
      }
    )
    // {
      nixosConfigurations.nix = nixpkgs.lib.nixosSystem {
        system = "aarch64-linux";
        modules = [
          /etc/nixos/configuration.nix
          ./vms/orb-nix.nix
        ];
      };
    };
}
