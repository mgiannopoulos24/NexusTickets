{
  description = "NexusTickets development environment";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      nixpkgs-unstable,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        unstablePkgs = import nixpkgs-unstable {
          inherit system;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Core tooling
            curl
            jq
            gnumake
            pre-commit

            # Backend (Go 1.22+)
            go
            gopls
            delve
            golangci-lint
            govulncheck
            wire
            air
            trivy

            # Local infra (optional, Docker still supported)
            postgresql_16
            redis
          ];
        };
      }
    );
}