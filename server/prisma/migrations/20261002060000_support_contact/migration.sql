CREATE TABLE "SupportContact" (
  "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Public contact details explicitly supplied by the owner. Future edits persist.
INSERT INTO "SupportContact" ("id", "email", "phone")
VALUES (1, 'aliibrahim3600@gmail.com', '+201062419263');
