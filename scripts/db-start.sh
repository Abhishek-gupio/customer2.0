#!/usr/bin/env bash
# Start PostgreSQL for local dev: use Docker if available, else Homebrew on macOS.
# Ensures user abhishekkumar and database valet_db exist so prisma:migrate:dev works.

set -e
DB_USER="${DB_USER:-abhishekkumar}"
DB_NAME="${DB_NAME:-valet_db}"
PORT=5432

# Prefer Homebrew's psql (postgresql@16 is keg-only and not on PATH by default)
PSQL="psql"
if [[ -x "/opt/homebrew/opt/postgresql@16/bin/psql" ]]; then
  PSQL="/opt/homebrew/opt/postgresql@16/bin/psql"
elif [[ -x "/opt/homebrew/opt/postgresql/bin/psql" ]]; then
  PSQL="/opt/homebrew/opt/postgresql/bin/psql"
fi

run_psql() {
  $PSQL postgres -c "$1" || true
}

# --- 1. Try Docker ---
if command -v docker &>/dev/null; then
  echo "Starting PostgreSQL with Docker..."
  docker compose up -d
  echo "Waiting for Postgres to accept connections..."
  for i in $(seq 1 30); do
    if (nc -z localhost $PORT 2>/dev/null) || (command -v timeout &>/dev/null && timeout 1 bash -c "echo >/dev/tcp/localhost/$PORT" 2>/dev/null); then
      echo "PostgreSQL is up. Run: pnpm db:migrate"
      exit 0
    fi
    sleep 1
  done
  echo "Docker started but port $PORT not ready. Wait a few seconds and run: pnpm db:migrate"
  exit 0
fi

# --- 2. Already something on 5432: ensure user and DB exist ---
if nc -z localhost $PORT 2>/dev/null; then
  echo "PostgreSQL is already running on port $PORT. Ensuring user '$DB_USER' and database '$DB_NAME' exist..."
  run_psql "CREATE USER $DB_USER WITH SUPERUSER;"
  run_psql "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  echo "Done. Run: pnpm db:migrate"
  exit 0
fi

# --- 3. Try Homebrew (macOS) ---
if command -v brew &>/dev/null; then
  echo "Docker not found. Starting PostgreSQL via Homebrew..."
  if brew services start postgresql@16 2>/dev/null; then
    true
  else
    brew services start postgresql 2>/dev/null || true
  fi
  echo "Waiting for PostgreSQL..."
  for i in $(seq 1 30); do
    if nc -z localhost $PORT 2>/dev/null; then
      echo "PostgreSQL is up. Creating user and database if needed..."
      run_psql "CREATE USER $DB_USER WITH SUPERUSER;"
      run_psql "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
      echo "Done. Run: pnpm db:migrate"
      exit 0
    fi
    sleep 1
  done
  echo "PostgreSQL did not start in time. Try: brew install postgresql@16 && brew services start postgresql@16"
  exit 1
fi

# --- 4. No option available ---
echo "Could not start PostgreSQL: Docker and Homebrew not found."
echo ""
echo "Choose one:"
echo "  1. Install Docker: https://docs.docker.com/get-docker/"
echo "     Then run: pnpm db:up && pnpm db:migrate"
echo "  2. Install Postgres.app: https://postgresapp.com/"
echo "     Then in psql: CREATE USER $DB_USER SUPERUSER; CREATE DATABASE $DB_NAME OWNER $DB_USER;"
echo "     Copy: cp prisma/.env.local.example prisma/.env"
echo "     Then run: pnpm db:migrate"
echo "  3. Install Homebrew (https://brew.sh) then: brew install postgresql@16 && brew services start postgresql@16"
echo "     Then run this script again."
exit 1
