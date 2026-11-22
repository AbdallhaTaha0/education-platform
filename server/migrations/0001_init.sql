-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "csrfHash" TEXT,
    "absoluteExpiresAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "revokeReason" TEXT,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "bioAr" TEXT,
    "bioEn" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Course" (
    "revisionOwnerId" TEXT,
    "workingCopyId" TEXT,
    "requestedSlug" TEXT,
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "coverId" TEXT,
    "subjectId" TEXT,
    "teacherId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priorStatus" TEXT,
    "publishedAt" DATETIME,
    "firstPublicationAt" DATETIME,
    "archivedAt" DATETIME,
    "deletionRequestedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "grade" TEXT,
    "academicYear" TEXT,
    "term" INTEGER,
    "courseKind" TEXT,
    "teachingMonth" TEXT,
    CONSTRAINT "Course_revisionOwnerId_fkey" FOREIGN KEY ("revisionOwnerId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Course_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "CourseCover" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Course_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseCover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bytes" BLOB NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Assessment" (
    "originId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "required" BOOLEAN NOT NULL,
    "draftRequired" BOOLEAN,
    "version" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assessment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "assessmentId" TEXT,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentDraft_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentDraft_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "answers" JSONB,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "leaseToken" TEXT,
    "leasedUntil" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentSubmission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentSubmission_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssessmentVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentPass" (
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "passedVersion" INTEGER NOT NULL,
    "passedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("studentId", "assessmentId"),
    CONSTRAINT "AssessmentPass_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentPass_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreservedLessonUnlock" (
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("studentId", "lessonId"),
    CONSTRAINT "PreservedLessonUnlock_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PreservedLessonUnlock_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PracticeQuota" (
    "studentId" TEXT NOT NULL PRIMARY KEY,
    "limit" INTEGER,
    "anchor" DATETIME,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PracticeQuota_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PracticeRun" (
    "studentId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("studentId", "idempotencyKey"),
    CONSTRAINT "PracticeRun_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentQueueBudget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 10000
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "nationalIdCipher" TEXT,
    "nationalIdFingerprint" TEXT,
    "nationalIdLast4" TEXT,
    "parentPhone" TEXT,
    "schoolYear" TEXT,
    "governorate" TEXT,
    "schoolName" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PythonRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "source" TEXT,
    "input" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "error" TEXT,
    "leaseToken" TEXT,
    "leasedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PythonRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PythonRun_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseSection" (
    "originId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "originId" TEXT,
    "inheritedMediaId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialObject" (
    "storageKey" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LessonResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "originId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "currentPricePiastres" INTEGER NOT NULL,
    "previousPricePiastres" INTEGER,
    "durationDays" INTEGER,
    "accessMode" TEXT NOT NULL DEFAULT 'DURATION',
    "accessEndsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionPlan_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaMapping" (
    "retiredAt" DATETIME,
    "retirementOperationId" TEXT,
    "retirementNextAttempt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "externalAssetId" TEXT NOT NULL,
    "assetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOAD_PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "uploadCompletedAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "errorCategory" TEXT,
    "durationSeconds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediaMapping_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatalogDeletionOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "courseId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCategory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "CatalogDeletionAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operationId" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "drmAssetId" TEXT,
    "externalAssetId" TEXT NOT NULL,
    "drmDeletionId" TEXT,
    "lastState" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" DATETIME,
    "errorCategory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogDeletionAsset_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CatalogDeletionOperation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balancePiastres" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "amountPiastres" INTEGER NOT NULL,
    "entryType" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RechargeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "amountPiastres" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "referenceNorm" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "transferDate" DATETIME NOT NULL,
    "proofFilename" TEXT NOT NULL,
    "proofMime" TEXT NOT NULL,
    "proofSize" INTEGER NOT NULL,
    "proofHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" DATETIME,
    "notificationRecordedAt" DATETIME,
    "rejectReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RechargeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RechargeProof" (
    "requestId" TEXT NOT NULL PRIMARY KEY,
    "bytes" BLOB,
    "storageKey" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "cleanedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RechargeProof_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RechargeRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectNameAr" TEXT,
    "subjectNameEn" TEXT,
    "teacherId" TEXT,
    "teacherNameAr" TEXT,
    "teacherNameEn" TEXT,
    "pricePiastres" INTEGER NOT NULL,
    "durationDays" INTEGER,
    "accessMode" TEXT NOT NULL DEFAULT 'DURATION',
    "accessEndsAt" DATETIME,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "packagePurchaseId" TEXT,
    "startsAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_packagePurchaseId_fkey" FOREIGN KEY ("packagePurchaseId") REFERENCES "PackagePurchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoursePackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pricePiastres" INTEGER NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PackageMember" (
    "packageId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("packageId", "courseId"),
    CONSTRAINT "PackageMember_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CoursePackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PackageMember_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackagePurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "pricePiastres" INTEGER NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PackagePurchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackagePurchaseItem" (
    "purchaseId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "subjectId" TEXT,
    "subjectNameAr" TEXT,
    "subjectNameEn" TEXT,
    "teacherId" TEXT,
    "teacherNameAr" TEXT,
    "teacherNameEn" TEXT,

    PRIMARY KEY ("purchaseId", "courseId"),
    CONSTRAINT "PackagePurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PackagePurchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "positionSeconds" REAL NOT NULL DEFAULT 0,
    "durationSeconds" REAL,
    "completedAt" DATETIME,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaybackReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "externalSessionId" TEXT NOT NULL,
    "externalAssetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "terminationStatus" TEXT,
    "pendingEndReason" TEXT,
    "terminationAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextTerminationAt" DATETIME,
    "lastErrorCategory" TEXT,
    "tokenExpiresAt" DATETIME NOT NULL,
    "sessionExpiresAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaybackReference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaybackReference_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "courseId" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseExpiresAt" DATETIME,
    "fanoutCursor" TEXT,
    "lastErrorCategory" TEXT
);

-- CreateTable
CREATE TABLE "NotificationAudience" (
    "eventId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "materializedAt" DATETIME,

    PRIMARY KEY ("eventId", "recipientId"),
    CONSTRAINT "NotificationAudience_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationAudience_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientSequence" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "readAt" DATETIME,
    "signalPending" BOOLEAN NOT NULL DEFAULT true,
    "signalAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextSignalAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_eventId_recipientId_fkey" FOREIGN KEY ("eventId", "recipientId") REFERENCES "NotificationAudience" ("eventId", "recipientId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationInboxState" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "lastSequence" BIGINT NOT NULL DEFAULT 0,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "deliveredRevision" BIGINT NOT NULL DEFAULT 0,
    "signalLeaseToken" TEXT,
    "signalLeaseExpiresAt" DATETIME,
    "signalNextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationInboxState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationExpiryMarker" (
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "recordedExpiry" DATETIME NOT NULL,

    PRIMARY KEY ("studentId", "courseId"),
    CONSTRAINT "NotificationExpiryMarker_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationRollout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "installedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstaPaySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "enabled" BOOLEAN NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "instructionsAr" TEXT NOT NULL,
    "instructionsEn" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    "qrBytes" BLOB,
    "qrMime" TEXT
);

-- CreateTable
CREATE TABLE "AssessmentPreparation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "leaseToken" TEXT,
    "leasedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentPreparation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VodafoneCashSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "enabled" BOOLEAN NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "instructionsAr" TEXT NOT NULL,
    "instructionsEn" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "M10VideoViewSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "mediaExternalAssetId" TEXT NOT NULL,
    "playbackReferenceId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedAt" DATETIME,
    "playedMilliseconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "M10VideoViewSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "M10VideoViewSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "M10ViewTrackingState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_absoluteExpiresAt_idx" ON "AuthSession"("absoluteExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE INDEX "Subject_active_position_idx" ON "Subject"("active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_slug_key" ON "Teacher"("slug");

-- CreateIndex
CREATE INDEX "Teacher_active_position_idx" ON "Teacher"("active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Course_workingCopyId_key" ON "Course"("workingCopyId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_revisionOwnerId_idx" ON "Course"("revisionOwnerId");

-- CreateIndex
CREATE INDEX "Course_grade_academicYear_term_courseKind_idx" ON "Course"("grade", "academicYear", "term", "courseKind");

-- CreateIndex
CREATE INDEX "Course_grade_subjectId_teacherId_academicYear_term_courseKind_idx" ON "Course"("grade", "subjectId", "teacherId", "academicYear", "term", "courseKind");

-- CreateIndex
CREATE INDEX "Course_subjectId_status_idx" ON "Course"("subjectId", "status");

-- CreateIndex
CREATE INDEX "Course_teacherId_status_idx" ON "Course"("teacherId", "status");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "Course_deletionRequestedAt_idx" ON "Course"("deletionRequestedAt");

-- CreateIndex
CREATE INDEX "Assessment_lessonId_status_idx" ON "Assessment"("lessonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentVersion_assessmentId_version_key" ON "AssessmentVersion"("assessmentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentDraft_studentId_context_key" ON "AssessmentDraft"("studentId", "context");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_state_leasedUntil_createdAt_idx" ON "AssessmentSubmission"("state", "leasedUntil", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_studentId_assessmentId_createdAt_idx" ON "AssessmentSubmission"("studentId", "assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_assessmentId_createdAt_id_idx" ON "AssessmentSubmission"("assessmentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_createdAt_idx" ON "AssessmentSubmission"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSubmission_studentId_idempotencyKey_key" ON "AssessmentSubmission"("studentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PracticeRun_createdAt_idx" ON "PracticeRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_nationalIdFingerprint_key" ON "StudentProfile"("nationalIdFingerprint");

-- CreateIndex
CREATE INDEX "PythonRun_state_leasedUntil_createdAt_idx" ON "PythonRun"("state", "leasedUntil", "createdAt");

-- CreateIndex
CREATE INDEX "PythonRun_userId_createdAt_idx" ON "PythonRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PythonRun_createdAt_idx" ON "PythonRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PythonRun_userId_idempotencyKey_key" ON "PythonRun"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CourseSection_courseId_position_idx" ON "CourseSection"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSection_courseId_position_key" ON "CourseSection"("courseId", "position");

-- CreateIndex
CREATE INDEX "Lesson_sectionId_position_idx" ON "Lesson"("sectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_sectionId_position_key" ON "Lesson"("sectionId", "position");

-- CreateIndex
CREATE INDEX "MaterialObject_state_updatedAt_idx" ON "MaterialObject"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonResource_storageKey_key" ON "LessonResource"("storageKey");

-- CreateIndex
CREATE INDEX "LessonResource_lessonId_idx" ON "LessonResource"("lessonId");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_courseId_idx" ON "SubscriptionPlan"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaMapping_lessonId_key" ON "MediaMapping"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaMapping_externalAssetId_key" ON "MediaMapping"("externalAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaMapping_assetId_key" ON "MediaMapping"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaMapping_idempotencyKey_key" ON "MediaMapping"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MediaMapping_status_idx" ON "MediaMapping"("status");

-- CreateIndex
CREATE INDEX "MediaMapping_assetId_idx" ON "MediaMapping"("assetId");

-- CreateIndex
CREATE INDEX "MediaMapping_retiredAt_retirementNextAttempt_idx" ON "MediaMapping"("retiredAt", "retirementNextAttempt");

-- CreateIndex
CREATE INDEX "CatalogDeletionOperation_target_idx" ON "CatalogDeletionOperation"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "CatalogDeletionOperation_status_idx" ON "CatalogDeletionOperation"("status");

-- CreateIndex
CREATE INDEX "CatalogDeletionOperation_courseId_idx" ON "CatalogDeletionOperation"("courseId");

-- CreateIndex
CREATE INDEX "CatalogDeletionAsset_operationId_idx" ON "CatalogDeletionAsset"("operationId");

-- CreateIndex
CREATE INDEX "CatalogDeletionAsset_drmDeletionId_idx" ON "CatalogDeletionAsset"("drmDeletionId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_walletId_idx" ON "WalletLedgerEntry"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLedgerEntry_refType_refId_key" ON "WalletLedgerEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "RechargeRequest_studentId_status_idx" ON "RechargeRequest"("studentId", "status");

-- CreateIndex
CREATE INDEX "RechargeRequest_status_idx" ON "RechargeRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RechargeRequest_channel_referenceNorm_key" ON "RechargeRequest"("channel", "referenceNorm");

-- CreateIndex
CREATE UNIQUE INDEX "RechargeRequest_studentId_idempotencyKey_key" ON "RechargeRequest"("studentId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RechargeProof_storageKey_key" ON "RechargeProof"("storageKey");

-- CreateIndex
CREATE INDEX "Purchase_studentId_idx" ON "Purchase"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_studentId_idempotencyKey_key" ON "Purchase"("studentId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_purchaseId_key" ON "Subscription"("purchaseId");

-- CreateIndex
CREATE INDEX "Subscription_studentId_courseId_idx" ON "Subscription"("studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_packagePurchaseId_courseId_key" ON "Subscription"("packagePurchaseId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageMember_packageId_position_key" ON "PackageMember"("packageId", "position");

-- CreateIndex
CREATE INDEX "PackagePurchase_studentId_createdAt_idx" ON "PackagePurchase"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackagePurchase_studentId_idempotencyKey_key" ON "PackagePurchase"("studentId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PackagePurchaseItem_purchaseId_position_key" ON "PackagePurchaseItem"("purchaseId", "position");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LessonProgress_studentId_courseId_idx" ON "LessonProgress"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "LessonProgress_studentId_lastAccessedAt_idx" ON "LessonProgress"("studentId", "lastAccessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_studentId_lessonId_key" ON "LessonProgress"("studentId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybackReference_externalSessionId_key" ON "PlaybackReference"("externalSessionId");

-- CreateIndex
CREATE INDEX "PlaybackReference_studentId_status_idx" ON "PlaybackReference"("studentId", "status");

-- CreateIndex
CREATE INDEX "PlaybackReference_status_nextTerminationAt_idx" ON "PlaybackReference"("status", "nextTerminationAt");

-- CreateIndex
CREATE INDEX "PlaybackReference_studentId_courseId_idx" ON "PlaybackReference"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "PlaybackReference_courseId_status_idx" ON "PlaybackReference"("courseId", "status");

-- CreateIndex
CREATE INDEX "PlaybackReference_externalAssetId_status_idx" ON "PlaybackReference"("externalAssetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_eventKey_key" ON "NotificationEvent"("eventKey");

-- CreateIndex
CREATE INDEX "NotificationEvent_deliveryStatus_nextAttemptAt_id_idx" ON "NotificationEvent"("deliveryStatus", "nextAttemptAt", "id");

-- CreateIndex
CREATE INDEX "NotificationEvent_expiresAt_idx" ON "NotificationEvent"("expiresAt");

-- CreateIndex
CREATE INDEX "NotificationAudience_recipientId_idx" ON "NotificationAudience"("recipientId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_expiresAt_idx" ON "Notification"("recipientId", "readAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_signalPending_nextSignalAt_id_idx" ON "Notification"("signalPending", "nextSignalAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_eventId_recipientId_key" ON "Notification"("eventId", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientId_recipientSequence_key" ON "Notification"("recipientId", "recipientSequence");

-- CreateIndex
CREATE INDEX "AssessmentPreparation_state_leasedUntil_createdAt_idx" ON "AssessmentPreparation"("state", "leasedUntil", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPreparation_assessmentId_contentHash_key" ON "AssessmentPreparation"("assessmentId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "M10VideoViewSession_playbackReferenceId_key" ON "M10VideoViewSession"("playbackReferenceId");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_studentId_courseId_idx" ON "M10VideoViewSession"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_studentId_courseId_lessonId_idx" ON "M10VideoViewSession"("studentId", "courseId", "lessonId");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_studentId_courseId_countedAt_idx" ON "M10VideoViewSession"("studentId", "courseId", "countedAt");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_courseId_lessonId_countedAt_idx" ON "M10VideoViewSession"("courseId", "lessonId", "countedAt");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_lessonId_countedAt_idx" ON "M10VideoViewSession"("lessonId", "countedAt");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_mediaAssetId_countedAt_idx" ON "M10VideoViewSession"("mediaAssetId", "countedAt");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_countedAt_idx" ON "M10VideoViewSession"("countedAt");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_startedAt_idx" ON "M10VideoViewSession"("startedAt");

-- CreateIndex
CREATE INDEX "M10VideoViewSession_studentId_countedAt_idx" ON "M10VideoViewSession"("studentId", "countedAt");

