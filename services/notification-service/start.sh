#!/bin/sh
set -eu

echo "Applying notification schema..."
bunx drizzle-kit push

exec bun run src/index.ts
