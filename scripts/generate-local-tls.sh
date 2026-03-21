#!/usr/bin/env sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/docker/tls/local"
mkdir -p "${OUT}"
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "${OUT}/key.pem" \
  -out "${OUT}/cert.pem" \
  -config "${ROOT}/docker/tls/openssl-local.cnf" \
  -extensions v3_req
chmod 600 "${OUT}/key.pem"
echo "Wrote ${OUT}/cert.pem and ${OUT}/key.pem (localhost SAN)."
