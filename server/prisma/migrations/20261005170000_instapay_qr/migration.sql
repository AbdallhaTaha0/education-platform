ALTER TABLE "InstaPaySettings" ADD COLUMN "qrBytes" BYTEA, ADD COLUMN "qrMime" TEXT;
ALTER TABLE "InstaPaySettings" ADD CONSTRAINT "instapay_qr_size_type" CHECK (
  ("qrBytes" IS NULL AND "qrMime" IS NULL) OR
  ("qrBytes" IS NOT NULL AND "qrMime" IS NOT NULL AND octet_length("qrBytes") BETWEEN 1 AND 131072 AND "qrMime" IN ('image/png', 'image/jpeg'))
);
