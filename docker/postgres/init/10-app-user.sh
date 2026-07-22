#!/bin/sh
set -e

# Runs once, on first initialization of the Postgres data directory
# (files placed in /docker-entrypoint-initdb.d/ are executed by the official
# postgres image only when the data volume is empty).
#
# The official image creates POSTGRES_USER / POSTGRES_DB for us but ignores the
# custom POSTGRES_APP_* variables. This script creates the dedicated,
# non-superuser application role that the backend and the seeder connect with
# (DB_USER=nexustickets_app) and grants it ownership of the application schema
# so GORM AutoMigrate can create tables.

APP_USER="${POSTGRES_APP_USER:-nexustickets_app}"
APP_PASSWORD="${POSTGRES_APP_PASSWORD:-nexustickets_app}"
APP_DB="${POSTGRES_APP_DB:-${POSTGRES_DB}}"

# 1) Create the login role (idempotent) and grant DB-level privileges.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	DO \$\$
	BEGIN
		IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_USER}') THEN
			CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}';
		END IF;
	END
	\$\$;

	GRANT ALL PRIVILEGES ON DATABASE ${APP_DB} TO ${APP_USER};
EOSQL

# 2) Grant schema-level privileges on the application database. In PostgreSQL 15+
#    the public schema no longer grants CREATE to PUBLIC, so the app role must
#    own the schema to run migrations.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$APP_DB" <<-EOSQL
	GRANT ALL ON SCHEMA public TO ${APP_USER};
	ALTER SCHEMA public OWNER TO ${APP_USER};
EOSQL

echo "app role '${APP_USER}' provisioned on database '${APP_DB}'"
