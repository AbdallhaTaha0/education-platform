-- Owner requested permanent removal of captions; lesson files are retained.
BEGIN;
LOCK TABLE "LessonCaption" IN ACCESS EXCLUSIVE MODE;
-- Persist cleanup before metadata disappears, including older rows without intents.
INSERT INTO "MaterialObject" ("storageKey", "state")
SELECT "storageKey", 'DELETE' FROM "LessonCaption"
ON CONFLICT ("storageKey") DO UPDATE SET "state" = 'DELETE', "updatedAt" = CURRENT_TIMESTAMP;
-- Also retire crash/partial-upload caption intents, never a live lesson resource.
UPDATE "MaterialObject" SET "state" = 'DELETE', "updatedAt" = CURRENT_TIMESTAMP
WHERE "storageKey" LIKE 'captions/%'
AND NOT EXISTS (SELECT 1 FROM "LessonResource" r WHERE r."storageKey" = "MaterialObject"."storageKey");
DROP TABLE "LessonCaption";
DROP TYPE "CaptionState";
-- Resource deletion trigger and durable object reconciler remain intact.
COMMIT;
