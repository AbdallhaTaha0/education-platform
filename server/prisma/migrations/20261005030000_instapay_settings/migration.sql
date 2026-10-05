CREATE TABLE "InstaPaySettings" (
  "id" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "accountLabel" TEXT NOT NULL,
  "instructionsAr" TEXT NOT NULL,
  "instructionsEn" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstaPaySettings_pkey" PRIMARY KEY ("id")
);
