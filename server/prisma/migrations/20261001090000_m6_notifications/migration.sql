-- Additive M6 inbox/outbox foundation. Producers and source markers arrive
-- separately; no existing money, catalog, identity or DRM data is rewritten.
CREATE TYPE "NotificationType" AS ENUM ('RECHARGE_APPROVED', 'RECHARGE_REJECTED', 'COURSE_PUBLISHED', 'SUBSCRIPTION_EXPIRED');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "NotificationEvent" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "courseId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "fanoutCursor" TEXT,
  "lastErrorCategory" TEXT,
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationEvent_version_check" CHECK ("schemaVersion" = 1),
  CONSTRAINT "NotificationEvent_retention_check" CHECK ("expiresAt" = "recordedAt" + INTERVAL '180 days'),
  CONSTRAINT "NotificationEvent_attempts_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "NotificationEvent_key_check" CHECK (length("eventKey") BETWEEN 1 AND 256),
  CONSTRAINT "NotificationEvent_course_check" CHECK (
    ("type" IN ('COURSE_PUBLISHED', 'SUBSCRIPTION_EXPIRED') AND "courseId" IS NOT NULL)
    OR ("type" IN ('RECHARGE_APPROVED', 'RECHARGE_REJECTED') AND "courseId" IS NULL)
  ),
  CONSTRAINT "NotificationEvent_lease_check" CHECK (("leaseToken" IS NULL) = ("leaseExpiresAt" IS NULL))
);

CREATE TABLE "NotificationAudience" (
  "eventId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "materializedAt" TIMESTAMP(3),
  CONSTRAINT "NotificationAudience_pkey" PRIMARY KEY ("eventId", "recipientId")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientSequence" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "readAt" TIMESTAMP(3),
  "signalPending" BOOLEAN NOT NULL DEFAULT true,
  "signalAttempts" INTEGER NOT NULL DEFAULT 0,
  "nextSignalAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_sequence_check" CHECK ("recipientSequence" > 0),
  CONSTRAINT "Notification_retention_check" CHECK ("expiresAt" = "createdAt" + INTERVAL '180 days'),
  CONSTRAINT "Notification_signal_attempts_check" CHECK ("signalAttempts" >= 0)
);

CREATE TABLE "NotificationInboxState" (
  "userId" TEXT NOT NULL,
  "lastSequence" BIGINT NOT NULL DEFAULT 0,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationInboxState_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "NotificationInboxState_counters_check" CHECK ("lastSequence" >= 0 AND "revision" >= "lastSequence")
);

CREATE UNIQUE INDEX "NotificationEvent_eventKey_key" ON "NotificationEvent"("eventKey");
CREATE INDEX "NotificationEvent_deliveryStatus_nextAttemptAt_id_idx" ON "NotificationEvent"("deliveryStatus", "nextAttemptAt", "id");
CREATE INDEX "NotificationEvent_expiresAt_idx" ON "NotificationEvent"("expiresAt");
CREATE INDEX "NotificationAudience_recipientId_idx" ON "NotificationAudience"("recipientId");
CREATE UNIQUE INDEX "Notification_eventId_recipientId_key" ON "Notification"("eventId", "recipientId");
CREATE UNIQUE INDEX "Notification_recipientId_recipientSequence_key" ON "Notification"("recipientId", "recipientSequence");
CREATE INDEX "Notification_recipientId_readAt_expiresAt_idx" ON "Notification"("recipientId", "readAt", "expiresAt");
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");
CREATE INDEX "Notification_signalPending_nextSignalAt_id_idx" ON "Notification"("signalPending", "nextSignalAt", "id");

ALTER TABLE "NotificationAudience"
  ADD CONSTRAINT "NotificationAudience_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NotificationAudience_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_eventId_recipientId_fkey" FOREIGN KEY ("eventId", "recipientId") REFERENCES "NotificationAudience"("eventId", "recipientId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationInboxState"
  ADD CONSTRAINT "NotificationInboxState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
