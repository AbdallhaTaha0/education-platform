CREATE TABLE "StudentProfile" (
  "userId" TEXT NOT NULL,
  "nationalIdCipher" TEXT,
  "nationalIdFingerprint" TEXT,
  "nationalIdLast4" TEXT,
  "parentPhone" TEXT,
  "schoolYear" TEXT,
  "governorate" TEXT,
  "schoolName" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentProfile_nationalId_pair" CHECK (
    ("nationalIdCipher" IS NULL AND "nationalIdFingerprint" IS NULL AND "nationalIdLast4" IS NULL) OR
    ("nationalIdCipher" IS NOT NULL AND "nationalIdFingerprint" IS NOT NULL AND "nationalIdLast4" IS NOT NULL AND "nationalIdLast4" ~ '^[0-9]{4}$')
  )
);
CREATE UNIQUE INDEX "StudentProfile_nationalIdFingerprint_key" ON "StudentProfile"("nationalIdFingerprint");
