# Prisma migration ownership (M1)

## Owned database
Platform PostgreSQL only (`DATABASE_URL`). Prisma migrations in this directory
must never reference the external DRM database, its tables, or its migration
history. Never point `DATABASE_URL` at DRM credentials.

## Current history
- `20260927090000_m1_init` — empty foundation migration (`SELECT 1;` only).
  Proves `prisma migrate deploy` executes inside the one-shot `migrate`
  container and gates application startup (Compose `depends_on:
  service_completed_successfully`). No business tables are created in M1.

## Commands
- Apply (one-shot container / CI): `npm run db:migrate` (`prisma migrate deploy`)
- Create a new migration during development: `npm run db:migrate:dev`
- Inspect status: `npx prisma migrate status`

## Rules for later milestones
- Each business area (identity, wallet, catalog, purchases, learning) adds its
  own migration with a reviewable diff; never edit an applied migration.
- Rollback = deploy the previous image whose code is compatible with the older
  schema (non-destructive; no `migrate reset` against shared data).
- Write-capability smoke fixtures stay in isolated test databases and out of
  migrated history (see `tests/integration/db-write.test.ts`).
