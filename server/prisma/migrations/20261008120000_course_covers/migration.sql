CREATE TABLE
  "CourseCover" (
    "id" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseCover_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseCover_size" CHECK (octet_length("bytes") BETWEEN 1 AND 131072),
    CONSTRAINT "CourseCover_mime" CHECK ("mime" IN ('image/jpeg', 'image/png'))
  );

ALTER TABLE "Course"
ADD COLUMN "coverId" TEXT;

ALTER TABLE "Course" ADD CONSTRAINT "Course_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "CourseCover" ("id") ON DELETE SET NULL ON UPDATE CASCADE;