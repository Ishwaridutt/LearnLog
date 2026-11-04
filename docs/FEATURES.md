# Feature List

Build checklist for the Study Tracker. Rules referenced as §x live in [REQUIREMENTS.md](REQUIREMENTS.md).

| ID | Feature | Priority | Phase |
|---|---|---|---|
| F-01 | Profile + onboarding | Must | 1 |
| F-02 | Study fields CRUD, archive, delete | Must | 1 |
| F-03 | Topics CRUD, links, recall prompt, archive, delete | Must | 1 |
| F-04 | Single global timer with auto-pause | Must | 1 |
| F-05 | Long-session guard | Must | 1 |
| F-06 | Learning completion → first revision scheduled | Must | 1 |
| F-07 | Revision flow with grading, early revision, Mastered, pull-back | Must | 1 |
| F-08 | Scheduler + streak pure functions with tests | Must | 1 |
| F-09 | Field header stats | Must | 1 |
| F-10 | Field tabs with counts | Must | 1 |
| F-11 | Search, sort, status filter | Must | 1 |
| F-12 | Topic detail drawer with timeline | Must | 1 |
| F-13 | Field History tab with filters | Must | 1 |
| F-14 | Landing page with field tiles and badges | Must | 1 |
| F-15 | Streak card: current/longest, heatmap ⇄ ticks | Must | 1 |
| F-16 | Persistent timer bar | Must | 1 |
| F-17 | JSON export | Must | 1 |
| F-20 | Edit time segments | Should | 2 |
| F-21 | Settings page | Should | 2 |
| F-22 | JSON import | Should | 2 |
| F-23 | Cancel in-progress revision | Should | 2 |
| F-24 | Weak topics list | Should | 3 |
| F-25 | Target + pace indicator (toggle) | Should | 3 |
| F-26 | Per-field interval ladder | Should | 3 |
| F-30 | Cross-field Today view | Could | 4 |
| F-31 | Weekly review page | Could | 4 |
| F-32 | Automatic DB backups | Could | 4 |
| F-33 | Desktop packaging | Could | 4 |
| F-34 | Postgres/MySQL provider | Could | 4 |
| F-35 | AI recall question generation | Could | 4 |

---

## Phase 1: MVP acceptance criteria

### F-01 Profile + onboarding
- [ ] With no profile, every route redirects to `/welcome`, which asks for a name (1–60 chars, trimmed).
- [ ] Submitting creates Profile and default Settings and lands on the landing page.
- [ ] `/profile` shows name (editable), member-since date, total study time, and the Export button.

### F-02 Study fields
- [ ] Create with name (required, unique among existing fields), optional description, colour from a fixed palette of 8.
- [ ] Edit name, description, colour.
- [ ] Archive hides the field from the main grid and moves it to "Show archived"; unarchive restores it. Archived fields' revisions don't show in badges.
- [ ] Delete requires typing the field name to confirm and removes all topics, activities, segments.
- [ ] Archiving or deleting a field whose topic owns the running segment pauses it first.

### F-03 Topics
- [ ] Add dialog: name (required), description, recall prompt, 0..n links (label + http/https URL), all optional except name.
- [ ] All of these are editable later from the topic drawer; links can be added, edited, removed, reordered.
- [ ] New topic status is `NOT_STARTED` and shows a Start button.
- [ ] Archive hides a topic from all lists except History; its time still counts in totals. Unarchive restores it.
- [ ] Delete (confirm dialog) removes it and its activities; totals update.

### F-04 Single global timer
- [ ] At most one running segment app-wide (verified by a test that starts two activities in sequence).
- [ ] Starting B while A runs pauses A and shows the toast "Paused *A* (42m)".
- [ ] Pause, resume and end work from the Ongoing tab, the topic drawer and the timer bar.
- [ ] Reloading the page or restarting the browser keeps the timer running at the correct elapsed time.

### F-05 Long-session guard
- [ ] When the open segment exceeds `longSessionMinutes`, a modal appears on load and within 60 s while open.
- [ ] "Keep it" dismisses until the next app load.
- [ ] "Set end time" closes the segment at a chosen time (after start, not in the future); the activity becomes paused.

### F-06 Learning completion
- [ ] Ending learning sets topic `COMPLETED`, `completedAt`, `reviewStep = 0`, `nextDueDay = tomorrow` (study-day aware).
- [ ] The topic appears in Upcoming today and in Due now tomorrow.

### F-07 Revision flow
- [ ] "Revise" is available on `COMPLETED`/`MASTERED` topics with no open activity.
- [ ] If a recall prompt exists, it shows first; links and description are hidden until Reveal.
- [ ] End shows a grade picker with Forgot / Hard / Good and the resulting next-due date for each.
- [ ] Schedule updates exactly per §6.4; early revisions flagged and handled per §6.4.
- [ ] After a Good at the last step the topic shows "Mastered" and leaves revision lists; "Pull back" restarts at step 0, due tomorrow.

### F-08 Scheduler + streak (pure functions in `packages/shared`)
Unit tests must include:
- [ ] Brief example: step 1 due day 10, revised day 14, Good → due day 21.
- [ ] All-Good lifecycle: +1, +3, +7, +16, +35, +90, +180 → Mastered.
- [ ] Hard keeps the step; Forgot resets to step 0 and increments forgotCount.
- [ ] Early Good/Hard → no change; early Forgot → reset.
- [ ] `studyDay` with `dayStartHour = 4`: 01:30 counts as the previous day.
- [ ] Current streak not broken if today doesn't qualify yet; broken if yesterday didn't qualify.
- [ ] Longest streak across gaps.

### F-09 Field header
- [ ] Shows Total, Learning, Revision time (h m), counts Completed / In progress / Mastered, Recall % (or "–").
- [ ] Includes the live running segment; updates after every timer action.

### F-10 Tabs with counts
- [ ] Ongoing (n), All Topics (n), Revised (n), Revisions (due-now count), History. Counts exclude archived topics.
- [ ] Ongoing lists both in-progress learnings and revisions, tagged by type.
- [ ] Revised lists topics with revisionCount ≥ 1 with last revised date, step "k/7" and next due.
- [ ] Revisions shows Due now (capped at `dailyRevisionCap`, "+N more" expander, overdue labels) and Upcoming (next 2 days).
- [ ] All Topics shows "Not yet" for never-revised completed topics.

### F-11 Search and sort
- [ ] Case-insensitive name search (substring, so prefixes like `SW -` work), debounced 200 ms.
- [ ] Sort by Added date or Completed date, asc/desc (never-completed topics sort last).
- [ ] Status filter: All / Not started / In progress / Completed / Mastered.
- [ ] Available on All Topics and Revised tabs.

### F-12 Topic drawer + timeline
- [ ] Opens from any topic row; edits save inline.
- [ ] Timeline lists learning and each revision newest-first: date, duration, grade, early flag, step; expandable segments.
- [ ] Learning and revision entries are visually distinct (colour + label).

### F-13 History tab
- [ ] Lists completed and in-progress activities in the field, newest first.
- [ ] Filters: type (All/Learning/Revision), grade, date range (from/to), topic name search; combinable.
- [ ] Clicking a row opens the topic drawer.

### F-14 Landing page
- [ ] Grid of active fields with name, colour, total time, completed/total topics.
- [ ] Badges: ▶ Running (tile border highlighted, pulsing), ⏸ Paused, "N due", "N upcoming" (hidden at zero).
- [ ] "+ New field" button; "Show archived" toggle.
- [ ] Empty state guides the user to create their first field.

### F-15 Streak card
- [ ] Current 🔥 and longest streak per §6.8.
- [ ] Dropdown switches Heatmap ⇄ Calendar (ticks); choice saved in settings.
- [ ] Heatmap: 53 weeks, 5 intensity levels per §6.10, tooltip with minutes and completions.
- [ ] Ticks: month grid with ✓ on qualifying days, today highlighted, prev/next month navigation.

### F-16 Timer bar
- [ ] Visible on all pages while any activity is in progress: topic, field, type, live elapsed (HH:MM:SS), Pause/Resume, End.
- [ ] If several are paused, it shows the running one, or else the most recently paused, plus "+N paused".

### F-17 Export
- [ ] Profile → Export downloads `study-tracker-YYYY-MM-DD.json` containing all tables and a schema version.
