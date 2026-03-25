#!/bin/sh
set -eu

echo "Applying order schema..."
bunx drizzle-kit push

exec bun run src/index.ts
