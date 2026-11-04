-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "revisionIntervals" TEXT NOT NULL DEFAULT '[1,3,7,16,35,90,180]',
    "dayStartHour" INTEGER NOT NULL DEFAULT 0,
    "dailyRevisionCap" INTEGER NOT NULL DEFAULT 5,
    "longSessionMinutes" INTEGER NOT NULL DEFAULT 180,
    "calendarView" TEXT NOT NULL DEFAULT 'HEATMAP'
);

-- CreateTable
CREATE TABLE "StudyField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "recallPrompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "reviewStep" INTEGER,
    "nextDueDay" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "lastRevisedAt" DATETIME,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "forgotCount" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Topic_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "StudyField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TopicLink_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "grade" TEXT,
    "isEarly" BOOLEAN NOT NULL DEFAULT false,
    "stepAtStart" INTEGER,
    "dueDayAtStart" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "completedDay" TEXT,
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Activity_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TimeSegment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Topic_fieldId_idx" ON "Topic"("fieldId");

-- CreateIndex
CREATE INDEX "Topic_nextDueDay_idx" ON "Topic"("nextDueDay");

-- CreateIndex
CREATE INDEX "TopicLink_topicId_idx" ON "TopicLink"("topicId");

-- CreateIndex
CREATE INDEX "Activity_topicId_idx" ON "Activity"("topicId");

-- CreateIndex
CREATE INDEX "Activity_completedDay_idx" ON "Activity"("completedDay");

-- CreateIndex
CREATE INDEX "TimeSegment_activityId_idx" ON "TimeSegment"("activityId");

-- CreateIndex
CREATE INDEX "TimeSegment_endedAt_idx" ON "TimeSegment"("endedAt");
