-- Explicit indefinite access; purchased durations/deadlines are preserved.
ALTER TYPE "AccessMode" ADD VALUE 'UNTIL_REMOVAL';
ALTER TABLE "Subscription" ALTER COLUMN "expiresAt" DROP NOT NULL;
ALTER TABLE "SubscriptionPlan" DROP CONSTRAINT "SubscriptionPlan_access_shape";
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_access_shape" CHECK (
 ("accessMode"::text = 'DURATION' AND "durationDays" IS NOT NULL AND "accessEndsAt" IS NULL) OR
 ("accessMode"::text IN ('TERM_END','YEAR_END') AND "durationDays" IS NULL AND "accessEndsAt" IS NOT NULL) OR
 ("accessMode"::text = 'UNTIL_REMOVAL' AND "durationDays" IS NULL AND "accessEndsAt" IS NULL));
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_access_shape";
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_access_shape" CHECK (
 ("accessMode"::text = 'DURATION' AND "durationDays" IS NOT NULL AND "accessEndsAt" IS NULL) OR
 ("accessMode"::text IN ('TERM_END','YEAR_END') AND "durationDays" IS NULL AND "accessEndsAt" IS NOT NULL) OR
 ("accessMode"::text = 'UNTIL_REMOVAL' AND "durationDays" IS NULL AND "accessEndsAt" IS NULL));
