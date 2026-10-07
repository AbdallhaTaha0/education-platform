-- Owner-approved free standalone course plans. Existing access snapshots and
-- positive/negative ledger invariants remain; free enrollment posts no debit.
ALTER TABLE "SubscriptionPlan" DROP CONSTRAINT "SubscriptionPlan_currentPrice_bounds";
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_currentPrice_bounds"
  CHECK ("currentPricePiastres" >= 0 AND "currentPricePiastres" <= 2000000000);
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_snapshot_check";
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_snapshot_check"
  CHECK ("pricePiastres" >= 0 AND "durationDays" BETWEEN 1 AND 3650);
