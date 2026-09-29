-- M4 independent-review correction: enforce financial, review-state, proof,
-- purchase-snapshot and subscription invariants at the database boundary.

ALTER TABLE "Wallet"
  ADD CONSTRAINT "Wallet_balance_nonnegative_check"
  CHECK ("balancePiastres" >= 0);

ALTER TABLE "WalletLedgerEntry"
  ADD CONSTRAINT "WalletLedgerEntry_signed_amount_check"
  CHECK (
    ("entryType" = 'CREDIT_RECHARGE' AND "amountPiastres" > 0) OR
    ("entryType" = 'DEBIT_PURCHASE' AND "amountPiastres" < 0)
  ),
  ADD CONSTRAINT "WalletLedgerEntry_reference_check"
  CHECK (length(btrim("refType")) > 0 AND length(btrim("refId")) > 0);

ALTER TABLE "RechargeRequest"
  ADD CONSTRAINT "RechargeRequest_amount_check"
  CHECK ("amountPiastres" BETWEEN 100 AND 100000000),
  ADD CONSTRAINT "RechargeRequest_reference_check"
  CHECK ("referenceNorm" ~ '^[A-Z0-9]{4,64}$'),
  ADD CONSTRAINT "RechargeRequest_proof_metadata_check"
  CHECK (
    "proofSize" BETWEEN 1 AND 5242880 AND
    "proofMime" IN ('image/jpeg', 'image/png', 'application/pdf') AND
    "proofHash" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "RechargeRequest_review_state_check"
  CHECK (
    ("status" = 'PENDING' AND "reviewerId" IS NULL AND "reviewedAt" IS NULL AND "rejectReason" IS NULL) OR
    ("status" = 'APPROVED' AND "reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "rejectReason" IS NULL) OR
    ("status" = 'REJECTED' AND "reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL AND length(btrim("rejectReason")) > 0)
  );

ALTER TABLE "RechargeProof"
  ADD CONSTRAINT "RechargeProof_content_check"
  CHECK (
    "size" BETWEEN 1 AND 5242880 AND
    "mime" IN ('image/jpeg', 'image/png', 'application/pdf') AND
    "hash" ~ '^[0-9a-f]{64}$' AND
    (("bytes" IS NOT NULL AND octet_length("bytes") = "size" AND "cleanedAt" IS NULL) OR
     ("bytes" IS NULL AND "cleanedAt" IS NOT NULL))
  );

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_snapshot_check"
  CHECK ("pricePiastres" > 0 AND "durationDays" BETWEEN 1 AND 3650);

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_interval_check"
  CHECK ("expiresAt" > "startsAt");
