#!/usr/bin/env bash
# Boots the embedded PostgreSQL, applies migrations, seeds the admin account,
# then runs the API (internal) and the web app (public, on $PORT).
set -euo pipefail

: "${SEED_ADMIN_PASSWORD:?Set SEED_ADMIN_PASSWORD to the admin login password}"

PGBIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
PGDATA=/var/lib/postgresql/data
random() { head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9'; }

# --- database ---------------------------------------------------------------
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA" && chown -R postgres:postgres "$PGDATA"
  # Local socket: peer auth (OS user postgres only). TCP: password required.
  su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth-local=peer --auth-host=scram-sha-256 --encoding=UTF8" >/dev/null
  cat >> "$PGDATA/postgresql.conf" <<'EOF'
listen_addresses = '127.0.0.1'
shared_buffers = 32MB
max_connections = 30
work_mem = 2MB
EOF
fi

mkdir -p /var/run/postgresql && chown postgres:postgres /var/run/postgresql
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -l $PGDATA/server.log -w start"

# The app's database password is generated on every boot; it never leaves the container.
DB_PASSWORD="${DB_PASSWORD:-$(random)}"
su postgres -c "psql -v ON_ERROR_STOP=1 -q" <<SQL
SELECT 'CREATE ROLE easytrip LOGIN' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'easytrip')\gexec
ALTER ROLE easytrip WITH PASSWORD '${DB_PASSWORD}';
SELECT 'CREATE DATABASE easytrip OWNER easytrip' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'easytrip')\gexec
SQL
export DATABASE_URL="postgresql://easytrip:${DB_PASSWORD}@127.0.0.1:5432/easytrip?schema=public"

# --- secrets ----------------------------------------------------------------
# Random per boot unless provided; sessions end on restart either way since the
# database resets with the container.
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-$(random)}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(random)}"
export WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:$PORT}"

# --- schema + seed ----------------------------------------------------------
cd /app/apps/api
npx prisma migrate deploy
npx tsx prisma/seed.ts

# --- app --------------------------------------------------------------------
node dist/main.js &
API_PID=$!

cd /app/apps/web
npx next start -p "$PORT" -H 0.0.0.0 &
WEB_PID=$!

shutdown() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -m fast stop" || true
}
trap shutdown SIGTERM SIGINT

# If either process dies, stop everything so the host restarts the container.
wait -n "$API_PID" "$WEB_PID" || true
shutdown
exit 1
