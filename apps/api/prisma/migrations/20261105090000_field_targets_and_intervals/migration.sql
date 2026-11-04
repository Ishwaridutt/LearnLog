-- F-25 targets and F-26 per-field intervals. Additive: existing fields get NULLs (no target, global intervals).
ALTER TABLE "StudyField" ADD COLUMN "revisionIntervals" TEXT;
ALTER TABLE "StudyField" ADD COLUMN "targetTopicCount" INTEGER;
ALTER TABLE "StudyField" ADD COLUMN "targetDate" TEXT;
ALTER TABLE "StudyField" ADD COLUMN "targetStartDay" TEXT;
ALTER TABLE "StudyField" ADD COLUMN "targetBaseline" INTEGER;
