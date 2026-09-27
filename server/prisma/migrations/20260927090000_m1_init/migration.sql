-- M1 foundation migration: intentionally creates no business tables.
-- It proves the migration pipeline (history table + one-shot `migrate deploy`
-- container + startup ordering) without inventing User/Wallet/Course models.
-- A write-capability smoke check runs only against isolated test databases
-- (see docker/compose.test.yml and tests/integration) using a transient
-- table that is created and dropped inside the test, never migrated here.
SELECT 1;
