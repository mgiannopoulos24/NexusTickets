#!/usr/bin/env bash
set -euo pipefail

# Runs once on first container initialization (when PGDATA is empty).
# Creates an application role + database and sets ownership.

: "${POSTGRES_APP_DB:=nexustickets}"
: "${POSTGRES_APP_USER:=nexustickets_app}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "postgres" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_APP_USER}') THEN
    CREATE ROLE ${POSTGRES_APP_USER} LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}';
  END IF;
END
\$\$;

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_APP_DB}') THEN
    CREATE DATABASE ${POSTGRES_APP_DB};
  END IF;
END
\$\$;

ALTER DATABASE ${POSTGRES_APP_DB} OWNER TO ${POSTGRES_APP_USER};
GRANT CONNECT, TEMPORARY ON DATABASE ${POSTGRES_APP_DB} TO ${POSTGRES_APP_USER};
SQL

# pgcrypto is required by seed migrations (crypt/gen_salt).
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_APP_DB}" <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
