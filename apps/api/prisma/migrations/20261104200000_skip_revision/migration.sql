-- "No revision needed" flag. Additive: existing topics default to false.
ALTER TABLE "Topic" ADD COLUMN "skipRevision" BOOLEAN NOT NULL DEFAULT false;
