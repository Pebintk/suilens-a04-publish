#!/bin/sh
set -eu

echo "Applying catalog schema..."
bunx drizzle-kit push

echo "Seeding catalog data..."
bun run src/db/seed.ts

exec bun run src/index.ts
