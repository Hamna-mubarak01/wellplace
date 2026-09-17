#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/db-test-down.sh
./scripts/db-test-up.sh
./scripts/db-migrate.sh
./scripts/db-seed.sh
