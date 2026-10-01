-- Bounded assessment-scoped keyset pagination; no submission data changes.
CREATE INDEX "AssessmentSubmission_assessmentId_createdAt_id_idx"
ON "AssessmentSubmission" ("assessmentId", "createdAt", "id");
