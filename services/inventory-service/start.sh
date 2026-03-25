#!/bin/sh
set -eu

echo "Applying inventory schema..."
bunx drizzle-kit push

echo "Seeding inventory data..."
bun run src/db/seed.ts

exec bun run src/index.ts
