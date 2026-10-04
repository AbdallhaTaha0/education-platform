-- Independent owned-object ledger survives all catalog cascades.
CREATE TABLE "MaterialObject" (
  "storageKey" TEXT PRIMARY KEY,
  "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING', 'LIVE', 'DELETE')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MaterialObject_state_updatedAt_idx" ON "MaterialObject"("state", "updatedAt");
INSERT INTO "MaterialObject" ("storageKey", "state")
  SELECT "storageKey", 'LIVE' FROM "LessonCaption"
  UNION SELECT "storageKey", 'LIVE' FROM "LessonResource";

-- Runs in the metadata deletion transaction, including FK cascades. Failed
-- transactions restore both metadata and availability; archive triggers none.
CREATE FUNCTION queue_material_object_deletion() RETURNS trigger AS $$
BEGIN
  INSERT INTO "MaterialObject" ("storageKey", "state") VALUES (OLD."storageKey", 'DELETE')
  ON CONFLICT ("storageKey") DO UPDATE SET "state" = 'DELETE', "updatedAt" = CURRENT_TIMESTAMP;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER caption_object_deletion AFTER DELETE ON "LessonCaption"
  FOR EACH ROW EXECUTE FUNCTION queue_material_object_deletion();
CREATE TRIGGER resource_object_deletion AFTER DELETE ON "LessonResource"
  FOR EACH ROW EXECUTE FUNCTION queue_material_object_deletion();
