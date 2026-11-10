-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plannedSeconds" INTEGER NOT NULL,
    "usedSeconds" INTEGER NOT NULL DEFAULT 0,
    "runningSince" DATETIME,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "topicId" TEXT,
    CONSTRAINT "FocusSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FocusSession_status_idx" ON "FocusSession"("status");

-- CreateIndex
CREATE INDEX "FocusSession_startedAt_idx" ON "FocusSession"("startedAt");

