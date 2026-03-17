{
  description = "NexusTickets development environment";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
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
        pkgs = import nixpkgs {
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

            # Backend (Go 1.22+)
            go_1_22
            gopls
            delve
            golangci-lint
            wire
            air

            # Frontend
            bun
            nodejs_22

            # Local infra (optional, Docker still supported)
            postgresql_16
            redis

            # Docker / Compose (for README workflow)
            docker
            docker-compose
          ];
        };
      }
    );
}
