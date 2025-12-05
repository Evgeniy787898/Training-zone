#!/bin/sh
set -euo pipefail

if [ -d /run/secrets ]; then
  for secret in /run/secrets/*; do
    [ -f "$secret" ] || continue
    key=$(basename "$secret")
    export "$key"="$(cat "$secret")"
  done
fi

exec "$@"
