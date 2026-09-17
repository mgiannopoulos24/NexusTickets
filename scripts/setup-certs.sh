#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/docker/tls/local"
mkdir -p "${OUT}"

if command -v mkcert >/dev/null 2>&1; then
  mkcert -install
  mkcert -key-file "${OUT}/key.pem" -cert-file "${OUT}/cert.pem" localhost 127.0.0.1 ::1
else
  echo "mkcert not found. Install from https://github.com/FiloSottile/mkcert"
  echo "Falling back to openssl..."
  cat > /tmp/openssl-local.cnf <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = GR
ST = Greece
L = Athens
O = NexusTickets Dev
CN = localhost

[v3_req]
keyUsage = digitalSignature, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "${OUT}/key.pem" \
    -out "${OUT}/cert.pem" \
    -config /tmp/openssl-local.cnf \
    -extensions v3_req
fi

chmod 600 "${OUT}/key.pem"
echo "Wrote ${OUT}/cert.pem and ${OUT}/key.pem"

# Vite dev server certs (for frontend/localhost*.pem)
mkcert -key-file "${ROOT}/frontend/localhost-key.pem" -cert-file "${ROOT}/frontend/localhost.pem" localhost 127.0.0.1 ::1 2>/dev/null
chmod 600 "${ROOT}/frontend/localhost-key.pem"
echo "Wrote frontend/localhost.pem and frontend/localhost-key.pem"
