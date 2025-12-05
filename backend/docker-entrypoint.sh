#!/bin/sh
set -euo pipefail

# Load Docker secrets into environment variables if present
if [ -d /run/secrets ]; then
  for secret in /run/secrets/*; do
    [ -f "$secret" ] || continue
    key=$(basename "$secret")
    export "$key"="$(cat "$secret")"
  done
fi

exec "$@"
