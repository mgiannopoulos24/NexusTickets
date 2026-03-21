# Local TLS (self-signed)

From the repository root:

```bash
make local-tls
```

This creates `cert.pem` and `key.pem` here. The production-style `docker compose` stack mounts them into nginx so you can open `https://localhost` (accept the browser warning once).

Do not commit `*.pem` files.
