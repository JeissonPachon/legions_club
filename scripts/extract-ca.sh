#!/usr/bin/env bash
# extract-ca.sh
# Usage: ./scripts/extract-ca.sh <host> [port] [out-file]
# Example: ./scripts/extract-ca.sh db.xxxxxx.supabase.co 5432 ./certs/ca.pem

set -euo pipefail
HOST=${1:-}
PORT=${2:-5432}
OUT=${3:-./certs/ca.pem}

if [ -z "$HOST" ]; then
  echo "Usage: $0 <host> [port] [out-file]"
  exit 2
fi

mkdir -p "$(dirname "$OUT")"
TMPFILE=$(mktemp)

# Fetch full certificate chain
openssl s_client -showcerts -servername "$HOST" -connect "$HOST:$PORT" </dev/null 2>/dev/null > "$TMPFILE" || true

# Extract PEM blocks
awk '/-----BEGIN CERTIFICATE-----/{f=1} f{print} /-----END CERTIFICATE-----/{f=0}' "$TMPFILE" > "$OUT"

# Basic validation
if [ ! -s "$OUT" ]; then
  echo "Failed to extract certificates from $HOST:$PORT"
  rm -f "$TMPFILE"
  exit 1
fi

echo "Wrote certificate chain to $OUT"
openssl x509 -in "$OUT" -noout -text | sed -n '1,3p'

rm -f "$TMPFILE"
