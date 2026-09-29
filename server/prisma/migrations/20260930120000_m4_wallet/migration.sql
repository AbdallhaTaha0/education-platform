-- M4 wallet, manual recharge, purchase, and subscription tables (additive only).
-- Money is integer piastres; floats are forbidden. Proof bytes are separated
-- from request/audit metadata. Purchase snapshots carry no FKs so later plan
-- edits/deletions never rewrite historical truth.

CREATE TYPE "RechargeChannel" AS ENUM ('INSTAPAY', 'BANK_TRANSFER', 'MOBILE_WALLET');
CREATE TYPE "RechargeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "LedgerEntryType" AS ENUM ('CREDIT_RECHARGE', 'DEBIT_PURCHASE');

CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balancePiastres" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountPiastres" INTEGER NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WalletLedgerEntry_refType_refId_key" ON "WalletLedgerEntry"("refType", "refId");
CREATE INDEX "WalletLedgerEntry_walletId_idx" ON "WalletLedgerEntry"("walletId");

CREATE TABLE "RechargeRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amountPiastres" INTEGER NOT NULL,
    "channel" "RechargeChannel" NOT NULL,
    "referenceNorm" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "proofFilename" TEXT NOT NULL,
    "proofMime" TEXT NOT NULL,
    "proofSize" INTEGER NOT NULL,
    "proofHash" TEXT NOT NULL,
    "status" "RechargeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RechargeRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RechargeRequest_channel_referenceNorm_key" ON "RechargeRequest"("channel", "referenceNorm");
CREATE UNIQUE INDEX "RechargeRequest_studentId_idempotencyKey_key" ON "RechargeRequest"("studentId", "idempotencyKey");
CREATE INDEX "RechargeRequest_studentId_status_idx" ON "RechargeRequest"("studentId", "status");
CREATE INDEX "RechargeRequest_status_idx" ON "RechargeRequest"("status");

CREATE TABLE "RechargeProof" (
    "requestId" TEXT NOT NULL,
    "bytes" BYTEA,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "cleanedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RechargeProof_pkey" PRIMARY KEY ("requestId")
);

CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "pricePiastres" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Purchase_studentId_idempotencyKey_key" ON "Purchase"("studentId", "idempotencyKey");
CREATE INDEX "Purchase_studentId_idx" ON "Purchase"("studentId");

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_purchaseId_key" ON "Subscription"("purchaseId");
CREATE INDEX "Subscription_studentId_courseId_idx" ON "Subscription"("studentId", "courseId");

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RechargeRequest" ADD CONSTRAINT "RechargeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RechargeProof" ADD CONSTRAINT "RechargeProof_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RechargeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
