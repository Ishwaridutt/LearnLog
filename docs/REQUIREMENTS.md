# LearnLog: Requirements Document

**Version:** 1.0 (draft for sign-off)  
**Date:** 2026-11-04  
**Owner:** Ishwari Dutt  
**Status:** Interview complete, awaiting approval before build

---

## 1. Problem statement

Learners who study deeply across several subjects (for example DSA, GenAI, System Design, or any exam syllabus) keep running into the same three problems:

1. **They forget.** Material learned once is mostly gone within weeks unless it is revisited, and nothing reminds them when to revisit it.
2. **Backlog panic.** After a few missed days, the amount of pending work feels huge and they quit. Fixed-calendar plans make this worse, because one missed day shifts everything.
3. **No visible progress.** Hours of study leave no trace, so motivation fades.

**The product:** a local-first, single-learner study tracker. The learner creates **Subjects** (e.g. "DSA 2026"), adds **Topics** as they start them, times every learning and revision session, and gets **spaced-repetition revisions** scheduled as a *queue*, not a calendar. Lateness never breaks the plan, and a streak calendar makes consistency visible.

The app is subject-agnostic. Nothing in it assumes computer science.

## 2. Success metrics

Measured from the app's own data after 8 weeks of use:

| # | Metric | Target | Why |
|---|---|---|---|
| M1 | Qualifying study days per week (rolling 8-week average) | ≥ 5 | Consistency |
| M2 | Longest streak by week 8 | ≥ 21 days | Consistency |
| M3 | Recall rate: % of on-schedule revisions graded **Good** at steps of 16 days or more | ≥ 70% | Retention, the core goal |
| M4 | Days where the due-now count is ≤ the daily cap | ≥ 80% | Backlog stays manageable |
| M5 | Clicks from landing page to a running timer | ≤ 2 | Low friction |
| M6 | Time to add a topic with 1 link | < 30 s | Low friction |
| M7 | Sessions that needed a long-session correction | < 5% | Honest time data |

## 3. Glossary

| Term | Meaning |
|---|---|
| **Subject** | What you're studying, e.g. "DSA 2026" or "UPSC History". Stored as `StudyField` in code and the API (`/fields`) |
| **Topic** | One sitting's worth of study (aim: 20–120 min). Belongs to one subject. Grouping is by name prefix, e.g. `SW - Max sum subarray` |
| **Activity** | One unit of work on a topic: either the **Learning** (exactly one per topic) or a **Revision** (many per topic) |
| **Segment** | One continuous running stretch of an activity's timer. Pause closes a segment; resume opens a new one |
| **Step** | Position in the revision interval ladder |
| **Study day** | Calendar day in local time, shifted by the configurable day-start hour (default 00:00) |
| **Qualifying day** | A study day on which at least one activity (learning or revision) was **completed** |

## 4. Functional requirements

Feature IDs refer to [FEATURES.md](FEATURES.md), which holds the acceptance criteria.

### 4.1 Must (MVP)

- **Profile:** first-run onboarding asks for the learner's name; a Profile page shows and edits it (F-01).
- **Study subjects:** create, edit, archive, unarchive, delete; unlimited count (F-02).
- **Topics:** create, edit name, description, recall prompt, and a list of labelled links (label + URL, add, edit, remove, reorder); archive and delete (F-03).
- **Single global timer:** start, pause, resume, end. Only one segment runs app-wide; starting another auto-pauses the running one and shows a toast (F-04).
- **Long-session guard:** a running segment older than the threshold (default 180 min) triggers a prompt to keep it or set the real end time (F-05).
- **Learning completion** schedules the first revision (F-06).
- **Revisions:** start (with the recall prompt shown first if present), pause, resume, end with a grade of Forgot, Hard or Good; early revisions allowed; Mastered after the final step; "pull back" from Mastered (F-07).
- **Scheduler** exactly as in §6, covered by unit tests (F-08).
- **Subject page header:** total time, learning time, revision time, topic counts (completed, in progress, mastered), recall rate (F-09).
- **Subject tabs with counts:** Ongoing, All Topics, Revised, Revisions (Due now with daily cap + Upcoming 2 days), History (F-10).
- **Search and sort** on topic lists: name search; sort by added date or completed date, ascending or descending (F-11).
- **Topic detail** with an activity timeline (F-12).
- **History tab** per subject with filters: type, grade, date range, topic name (F-13).
- **Landing page:** subject tiles with in-progress (running or paused) badge and colour change, due and upcoming revision badges, add-subject button (F-14).
- **Streak card:** current and longest streak; dropdown to switch between a heatmap and a month calendar with ticks (F-15).
- **Persistent running-timer bar** visible on every screen (F-16).
- **Export** of all data to JSON (F-17).

### 4.2 Should (Phase 2–3)

- Edit time segments (start and end) on any activity, with overlap validation (F-20).
- Settings page: interval ladder, day-start hour, daily cap, long-session threshold, default calendar view (F-21).
- Import from JSON (replace-all, with confirm) (F-22).
- Cancel an in-progress revision without recording it (F-23).
- UI polish: clear hover/press states on all clickable elements (F-27), dark mode with a Light/Dark toggle (F-28), compact multi-month calendar view (F-29).
- Weak topics list: topics with 2 or more Forgot grades (F-24).
- Optional target per subject (target date + target topic count) with an ahead/behind pace indicator, toggleable (F-25).
- Per-subject interval ladder override (F-26).

### 4.3 Could (later)

- Cross-subject "Today" view (F-30).
- Weekly review summary page for the last 7 days (F-31).
- Automatic daily DB backup file rotation (F-32).
- Desktop packaging (Electron or Tauri) (F-33).
- Postgres/MySQL support via Prisma provider switch (F-34).
- AI-generated recall questions from topic description and links (F-35).

### 4.4 Won't (explicitly dropped during interview)

- Minimum-effort day mode: revisions count toward the streak, which already covers bad days.
- Mock-interview day and other calendar planning: contradicts "queue, not calendar".
- Parent/child topics: use name prefixes and search instead.
- Streak freezes.
- Re-opening a completed topic's learning: use an early revision instead.

## 5. Data model

All timestamps are stored as UTC ISO datetimes. **Study days are stored as `YYYY-MM-DD` strings** so that date maths never runs into timezone shifts.

### Profile (single row)
| Field | Type | Notes |
|---|---|---|
| id | int | always 1 |
| name | string | required, 1–60 chars |
| createdAt, updatedAt | datetime | |

### Settings (single row)
| Field | Type | Default |
|---|---|---|
| id | int | 1 |
| revisionIntervals | JSON int[] | `[1,3,7,16,35,90,180]` |
| dayStartHour | int 0–23 | `0` (midnight) |
| dailyRevisionCap | int ≥ 1 | `5` |
| longSessionMinutes | int ≥ 30 | `180` |
| calendarView | enum `HEATMAP` \| `TICKS` | `HEATMAP` |

### StudyField
| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| name | string | required, unique among non-deleted subjects |
| description | string? | |
| color | string | hex, picked from a palette |
| archivedAt | datetime? | null = active |
| revisionIntervals | string? | F-26: JSON int[] custom ladder; null = global setting |
| targetTopicCount, targetDate | int?, string? | F-25: optional target (both or neither) |
| targetStartDay, targetBaseline | string?, int? | F-25: set by the server when a target is set or changed (today, completed count then) |
| createdAt, updatedAt | datetime | |

### Topic
| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| fieldId | FK → StudyField | cascade delete |
| name | string | required |
| description | string? | markdown allowed (rendered as plain text in MVP) |
| recallPrompt | string? | optional question shown before revision |
| status | enum `NOT_STARTED` \| `IN_PROGRESS` \| `COMPLETED` \| `MASTERED` | |
| reviewStep | int? | index into the interval ladder; null until learning completes |
| nextDueDay | string? `YYYY-MM-DD` | null until learning completes, and when Mastered |
| startedAt | datetime? | first learning segment start |
| completedAt | datetime? | learning end |
| lastRevisedAt | datetime? | completion of most recent revision; null = "Not yet" |
| revisionCount | int | completed revisions |
| forgotCount | int | Forgot grades received |
| skipRevision | bool | "No revision needed" (F-36): never enters the revision queue |
| archivedAt | datetime? | |
| createdAt, updatedAt | datetime | |

### TopicLink
| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| topicId | FK → Topic | cascade |
| label | string | e.g. "Video", "LeetCode", "Notes" |
| url | string | must be a valid http(s) URL |
| sortOrder | int | |

### Activity
| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| topicId | FK → Topic | cascade |
| type | enum `LEARNING` \| `REVISION` | at most one LEARNING per topic |
| status | enum `IN_PROGRESS` \| `COMPLETED` | running vs paused is derived from open segment |
| grade | enum `FORGOT` \| `HARD` \| `GOOD`? | revisions only, set on end |
| isEarly | bool | revision started before `nextDueDay` |
| stepAtStart | int? | snapshot, for history display |
| dueDayAtStart | string? | snapshot |
| startedAt | datetime | |
| completedAt | datetime? | |
| completedDay | string? | study day of completion, used for streaks |
| totalSeconds | int | cached sum of closed segments |

### TimeSegment
| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| activityId | FK → Activity | cascade |
| startedAt | datetime | |
| endedAt | datetime? | **null = the one running segment**; at most one null app-wide |
| edited | bool | true if changed by hand |

**Invariants**
1. At most one TimeSegment with `endedAt = null` in the whole DB (enforced in a transaction).
2. At most one non-completed Activity per topic.
3. At most one LEARNING Activity per topic.
4. Topic is `COMPLETED` or `MASTERED` ⇔ its LEARNING Activity is `COMPLETED`.

## 6. Scheduling and review algorithm

Let `I = settings.revisionIntervals` (default `[1,3,7,16,35,90,180]`) and `L = I.length`.

### 6.1 Study day
```
studyDay(ts)  = localDate(ts − dayStartHour hours)     // "YYYY-MM-DD"
today         = studyDay(now)
addDays(d, n) = calendar date d plus n days
```

### 6.2 Learning
- **Start** on a `NOT_STARTED` topic: create the LEARNING activity, open a segment, set `status = IN_PROGRESS` and `startedAt = now`.
- **End** at time `t`: close the open segment, set the activity to `COMPLETED`, and on the topic set:
  ```
  status      = COMPLETED
  completedAt = t
  reviewStep  = 0
  nextDueDay  = addDays(studyDay(t), I[0])        // tomorrow
  ```

### 6.3 Starting a revision
Allowed when topic status is `COMPLETED` or `MASTERED` and the topic has no open activity.
```
isEarly       = (status == MASTERED) OR (today < nextDueDay)
stepAtStart   = reviewStep
dueDayAtStart = nextDueDay
```
If the topic has a `recallPrompt`, the UI shows it first and hides links and description until the learner clicks **Reveal**. Timing starts when the revision starts, not on Reveal.

### 6.4 Ending a revision with grade `g` at time `t`
```
d = studyDay(t)
revisionCount += 1;  lastRevisedAt = t

if isEarly:
    if g == FORGOT:                    // forgetting is a real signal, even early
        reviewStep = 0; nextDueDay = addDays(d, I[0]); forgotCount += 1
        if status == MASTERED: status = COMPLETED
    else:
        no schedule change
else:
    switch g:
      GOOD:   s = reviewStep + 1
              if s >= L: status = MASTERED; reviewStep = L; nextDueDay = null
              else:      reviewStep = s;   nextDueDay = addDays(d, I[s])
      HARD:   nextDueDay = addDays(d, I[reviewStep])          // same step again
      FORGOT: reviewStep = 0; nextDueDay = addDays(d, I[0]); forgotCount += 1
```
**The next interval always counts from the actual completion day, never from the original due day.** There is no lateness penalty; the grade decides the step.

**Worked example (from the brief):** the day-1 revision was done on day 7 (Good), so the topic is at step 1 (interval 3) and due on day 10. It is actually revised on day 14 and graded Good → step 2 (interval 7) → next due = 14 + 7 = **day 21**, not day 17. It never appears before that.

**Lifecycle for a topic that is always Good:** due at +1, +3, +7, +16, +35, +90, +180 days after each previous revision → Mastered. Good never removes a topic early.

### 6.5 Mastered and pull-back
- Mastered topics leave Due/Upcoming and show a "Mastered" badge.
- **Pull back:** `status = COMPLETED; reviewStep = 0; nextDueDay = addDays(today, I[0])`.
- A Mastered topic can still get a practice revision, which follows the early rules.

### 6.5a "No revision needed" (F-36)
```
on learning end, if skipRevision:  status = COMPLETED; reviewStep = null; nextDueDay = null
set skipRevision = true:           nextDueDay = null            (reviewStep kept for history)
set skipRevision = false:          if COMPLETED: reviewStep = 0; nextDueDay = addDays(today, I[0])
revision on a skipRevision topic:  isEarly = true; logs lastRevisedAt / revisionCount only;
                                   never changes the schedule (not even Forgot); excluded from recall rate
```
Skipped topics still count as completed and keep their time. Mastered topics can't be toggled (already out of the queue).

### 6.6 Revision lists (per subject, excluding archived topics and topics with an open activity)
```
dueNow   = topics where nextDueDay <= today
           sorted by nextDueDay ASC, then reviewStep ASC, then name
           first `dailyRevisionCap` shown; rest collapsed as "+N more"
           items with nextDueDay < today are labelled "Overdue by X days"
upcoming = topics where today < nextDueDay <= addDays(today, 2), sorted by nextDueDay ASC
```
Topics with an in-progress revision appear in **Ongoing**, not in these lists.

### 6.7 Timer rules
- **start(activity):** if any open segment exists, close it at `now` (auto-pause) and return its topic name and elapsed time for the toast. Then open a new segment for `activity`. Runs in one DB transaction.
- **pause:** close the open segment; update `totalSeconds`.
- **resume:** same as start.
- **end:** close the open segment if one is open; mark complete; revisions require a grade.
- **Long-session guard:** when the UI loads, and every 60 s, if `now − openSegment.startedAt > longSessionMinutes`, show a modal: "You've been on *X* for 7h 12m." with options **Keep it**, or **Set end time** (datetime picker, must be after start and not in the future), which closes the segment at that time. The activity stays in progress (paused).
- Archiving or deleting a topic or subject that owns the running segment pauses it first.
- For minutes-per-day, a segment is split at each study-day boundary (`splitByStudyDay`), so a session from 23:30 to 01:00 counts 30 min on the first day and 60 on the second.

### 6.7a Per-subject intervals (F-26)
`I` in §6.2–6.5 is the topic's subject ladder if one is set, otherwise the global ladder. A change applies from each topic's next revision; a topic whose step is beyond a shorter new ladder is treated as on its last step.

### 6.7b Weak topics (F-24)
A topic (completed or mastered, not archived, not "no revision needed") is **weak** when at least 2 of its last 5 graded revisions (early ones included) were Forgot. It stops being weak once enough newer grades push those Forgots out of the window.

### 6.7c Target and pace (F-25)
When a target is set or its number/date changes: `startDay = today`, `baseline = completed topics now`.
```
total    = max(1, targetDate − startDay)          elapsed = clamp(today − startDay, 0, total)
expected = baseline + (target − baseline) × elapsed / total
status   = done      if completed ≥ target
           overdue   if today > targetDate
           ahead     if completed − expected ≥ 1
           behind    if completed − expected ≤ −1
           on_track  otherwise
perDayNeeded = (target − completed) / (daysLeft + 1)   (today counts)
```
"Completed" means completed or mastered topics (including "no revision needed") that aren't archived.

### 6.8 Streaks
```
qualifying(day) = exists Activity where status = COMPLETED and completedDay = day
                  (learning or revision, early included, archived included)
current streak  = start at today if qualifying(today), else yesterday;
                  count consecutive qualifying days backwards
longest streak  = longest run of consecutive qualifying days ever
```
Today not yet qualifying does **not** break the current streak until the day ends.

### 6.9 Statistics
- **Subject learning time** = Σ `totalSeconds` (plus the live open segment) of LEARNING activities in the subject.
- **Subject revision time** = same for REVISION activities. **Total** = learning + revision.
- **Recall rate** = Good ÷ all graded **non-early** revisions in the subject; shows "–" when there are none.
- Archived topics count toward totals; deleted topics do not.

### 6.10 Calendar
- **Heatmap:** last 53 weeks, one cell per study day, shaded by minutes: `0`, `1–29`, `30–89`, `90–179`, `180+`. Tooltip: date, minutes, completed learnings and revisions.
- **Ticks:** month grid with ✓ on qualifying days, prev/next month, same tooltip.
- Dropdown switches between them; the choice is saved to settings.

## 7. Key screens

1. **Onboarding (first run only).** "What should we call you?" Name field and a Continue button. Creates Profile and Settings.
2. **Landing page.**
   - Top bar: app name, greeting ("Hi, Ishwari"), Profile link.
   - Streak card: current 🔥 and longest streak, view dropdown (Heatmap or Calendar), then the calendar.
   - "Subjects" grid with a **+ Add subject** button. Each tile shows name, colour, total time, completed/total topics, and badges: **▶ Running** (green pulse, tile border coloured), **⏸ Paused** (amber), **N due** (red), **N upcoming** (grey). Click opens the subject.
   - "Show archived" toggle at the bottom.
3. **Subject page.**
   - Header: name, description, edit/archive/delete menu, and stat chips (Total, Learning, Revision, Completed / In progress / Mastered, Recall %).
   - **+ Add topic** button opens a dialog with name, description, recall prompt, and links (label + URL rows).
   - Tabs with count badges: **Ongoing (n) · All Topics (n) · Revised (n) · Revisions (due n) · History**.
   - *Ongoing:* cards with type tag (Learning/Revision), elapsed time, and Pause/Resume/End.
   - *All Topics:* search box, sort dropdown (Added / Completed, asc/desc), status filter; rows show name, status, time spent, completed date, last revised ("Not yet" if never), next due, and a Start/Revise button.
   - *Revised:* topics with revisionCount ≥ 1: last revised, step (e.g. "3/7"), next due, recall stats. Same search and sort.
   - *Revisions:* **Due now** section (cap applied, overdue labels, "+N more" expander) and **Upcoming (next 2 days)**, each row with a Start revision button.
   - *History:* table of activities (date, topic, type, duration, grade, early flag) with filters for type, grade, date range and topic search. Click a row to open the topic.
4. **Topic detail (side drawer).** Editable name, description, recall prompt, links; status and schedule (step, next due); actions (Start / Revise / Pull back / Archive / Delete); **timeline** of the learning and every revision, colour-coded, with segments expandable.
5. **Revision flow.** Start opens the recall card ("Answer from memory first") with a **Reveal** button showing links and notes; timer runs in the timer bar; **End** opens the grade picker (Forgot / Hard / Good) with a preview of the resulting next due date for each.
6. **Global timer bar.** Fixed at the bottom of every page when something is running or paused: topic, subject, type, live elapsed time, Pause/Resume/End.
7. **Profile.** Name, member since, totals; Export button (Settings and Import come in Phase 2).

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Local-only | No network calls except browser ↔ localhost API. No telemetry, no CDN fonts or scripts; everything bundled |
| Offline | Works with Wi-Fi off |
| Privacy | DB file in `./data/` (git-ignored). The repository never contains learner data |
| Setup | `npm install && npm run dev` from a fresh clone on Node LTS; DB is created and migrated automatically |
| Speed | API p95 < 100 ms and page interactive < 1 s with 50 subjects, 5,000 topics, 50,000 segments |
| Timer accuracy | Elapsed time computed from stored timestamps, not client tick counts; survives page reload and browser restart |
| Data integrity | Timer state changes in DB transactions; invariants in §5 enforced server-side |
| Backup | Export full JSON at any time; DB is a single copyable file |
| Testing | Scheduler, streak and timer services covered by unit tests, including every rule in §6 |
| Accessibility | Keyboard reachable, visible focus, colour never the only signal (badges have text) |
| Responsive | Usable down to 768 px wide in MVP |

## 9. Tech stack and project structure

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript everywhere | Your stack; shared types |
| Frontend | React + Vite + TypeScript | Fast dev, simple build |
| Styling | Tailwind CSS | As requested |
| Data fetching | TanStack Query | Caching and invalidation after timer actions |
| Routing | React Router | |
| Backend | NestJS | As requested; portfolio-friendly modular structure |
| DB | **SQLite** via **Prisma** | Zero install for other learners, single private file, provider switch later |
| Validation | Zod schemas in a shared package | One source of truth for FE and BE |
| Dates | date-fns | Study-day maths |
| Tests | Vitest (shared, web), Jest (api, the Nest default) | |
| Monorepo | npm workspaces + `concurrently` | No extra tooling for cloners |

```
study-tracker/
├─ package.json              # workspaces, "dev" runs api + web
├─ data/                     # study.db lives here (git-ignored)
├─ docs/  REQUIREMENTS.md  FEATURES.md
├─ packages/shared/          # types, zod DTOs, scheduler + streak pure functions
│  └─ src/  scheduler.ts  streak.ts  studyDay.ts  dto/
├─ apps/api/                 # NestJS
│  ├─ prisma/schema.prisma
│  └─ src/
│     ├─ profile/  settings/  fields/  topics/
│     ├─ activities/         # timer: start/pause/resume/end, segments
│     ├─ stats/              # summaries, streak, calendar
│     ├─ backup/             # export/import
│     └─ prisma/             # PrismaService
└─ apps/web/                 # React + Vite + Tailwind
   └─ src/
      ├─ api/                # typed client + query hooks
      ├─ pages/  Landing  FieldPage  Profile  Onboarding
      ├─ components/  TimerBar  FieldTile  StreakCard  Heatmap  TickCalendar
      │               TopicDrawer  RevisionFlow  Tabs  ...
      └─ lib/
```

The scheduler lives in `packages/shared` as **pure functions**. The API uses them to write state, and the UI uses them to preview "next due if Good/Hard/Forgot".

### API surface (REST, JSON, prefix `/api`)
```
GET  PUT   /profile                GET PUT /settings
GET  POST  /subjects                 GET PATCH DELETE /fields/:id
POST       /fields/:id/archive     /fields/:id/unarchive
GET        /fields/:id/summary     # header stats + tab counts
GET        /fields/:id/topics?tab=all|ongoing|revised&q=&sort=createdAt|completedAt&order=asc|desc&status=
GET        /fields/:id/revisions   # { dueNow, dueNowTotal, upcoming }
GET        /fields/:id/history?type=&grade=&from=&to=&q=
POST       /fields/:id/topics
GET  PATCH DELETE /topics/:id      POST /topics/:id/archive|unarchive|pull-back
POST       /topics/:id/learning/start
POST       /topics/:id/revisions/start
POST       /activities/:id/pause | resume | end {grade?}
GET        /timer/current
GET        /stats/streak           GET /stats/calendar?from=&to=
GET        /export                 POST /import (Phase 2)
```

## 10. Explicit non-goals (v1)

- No accounts, login, multi-user, or cloud sync.
- No mobile app or native desktop app (web on localhost only).
- No notifications, emails, or push reminders.
- No content authoring beyond description and recall prompt (not a notes app or flashcard deck).
- No AI features.
- No fixed calendar planning, deadlines per topic, or mock-interview scheduling.
- No nested topics.
- No gamification beyond streaks (no points, badges, levels).

## 11. Phased build plan

### Phase 1: MVP (one weekend)
**Saturday:** monorepo scaffold, Prisma schema and migration, shared scheduler + streak with tests, profile/onboarding, subjects CRUD + archive/delete, topics CRUD + links, timer engine (single global segment, auto-pause), learning start/end.  
**Sunday:** revision flow with recall prompt and grading, subject page header + 5 tabs + counts, search and sort, history tab with filters, topic drawer timeline, landing tiles with badges, streak card with heatmap and ticks, timer bar, long-session guard, JSON export.  
**Done when:** you can create "DSA 2026", add and time a topic, see it in Revisions tomorrow, grade it, and see your streak.

### Phase 2: Hardening (first week of evenings)
F-20 segment editing, F-21 settings page, F-22 import, F-23 cancel revision, F-27 hover states, F-28 dark mode, F-29 compact calendar, auto-backup decision.

### Phase 3: Insight (done)
F-24 weak topics, F-25 target and pace, F-26 per-subject intervals, plus splitting sessions across midnight in the calendar.

### Phase 4: Reach
F-30 Today view, F-31 weekly review, F-33 desktop packaging, README and screenshots for GitHub.

## 12. Open questions

1. **Forgot on an early revision resets the schedule** (§6.4). I added this because forgetting is a real signal. Keep it, or make early revisions never touch the schedule?
2. ~~Segments that cross the day boundary~~ Resolved: sessions are split across days (§6.7).
3. **Import behaviour:** replace-all (proposed) or merge?
4. **Long-paused topics:** should a topic paused for more than N days get a nudge badge?
5. **Pace indicator formula** (F-25): needs target topic count + target date; ahead/behind = completed vs. linear expectation. Confirm when Phase 3 starts.
6. **Desktop packaging:** Electron vs. Tauri, decided in Phase 4.
7. **Timezone travel:** study days use the machine's current timezone; a change may shift one day. Acceptable?
