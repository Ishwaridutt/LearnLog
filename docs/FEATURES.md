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
| F-27 | Clear hover/press states on everything clickable | Should | 2 |
| F-28 | Dark mode (Light / Dark toggle) | Should | 2 |
| F-29 | Compact month calendar | Should | 2 |
| F-24 | Weak topics list | Should | 3 |
| F-25 | Target + pace indicator (toggle) | Should | 3 |
| F-26 | Per-field interval ladder | Should | 3 |
| F-30 | Cross-field Today view | Could | 4 |
| F-31 | Weekly review page | Could | 4 |
| F-32 | Automatic DB backups | Could | 4 |
| F-33 | Desktop packaging | Could | 4 |
| F-34 | Postgres/MySQL provider | Could | 4 |
| F-35 | AI recall question generation | Could | 4 |
| F-36 | "No revision needed" per topic | Should | 2 |

---

## Phase 1: MVP acceptance criteria

### F-01 Profile + onboarding
- [x] With no profile, every route redirects to `/welcome`, which asks for a name (1–60 chars, trimmed).
- [x] Submitting creates Profile and default Settings and lands on the landing page.
- [x] `/profile` shows name (editable), member-since date, total study time, and the Export button.

### F-02 Study fields
- [x] Create with name (required, unique among existing fields), optional description, colour from a fixed palette of 8.
- [x] Edit name, description, colour.
- [x] Archive hides the field from the main grid and moves it to "Show archived"; unarchive restores it. Archived fields' revisions don't show in badges.
- [x] Delete requires typing the field name to confirm and removes all topics, activities, segments.
- [x] Archiving or deleting a field whose topic owns the running segment pauses it first.

### F-03 Topics
- [x] Add dialog: name (required), description, recall prompt, 0..n links (label + http/https URL), all optional except name.
- [x] All of these are editable later from the topic drawer; links can be added, edited, removed, reordered.
- [x] New topic status is `NOT_STARTED` and shows a Start button.
- [x] Archive hides a topic from all lists except History; its time still counts in totals. Unarchive restores it.
- [x] Delete (confirm dialog) removes it and its activities; totals update.

### F-04 Single global timer
- [x] At most one running segment app-wide (verified by a test that starts two activities in sequence).
- [x] Starting B while A runs pauses A and shows the toast "Paused *A* (42m)".
- [x] Pause, resume and end work from the Ongoing tab, the topic drawer and the timer bar.
- [x] Reloading the page or restarting the browser keeps the timer running at the correct elapsed time.

### F-05 Long-session guard
- [x] When the open segment exceeds `longSessionMinutes`, a modal appears on load and within 60 s while open.
- [x] "Keep it" dismisses until the next app load.
- [x] "Set end time" closes the segment at a chosen time (after start, not in the future); the activity becomes paused.

### F-06 Learning completion
- [x] Ending learning sets topic `COMPLETED`, `completedAt`, `reviewStep = 0`, `nextDueDay = tomorrow` (study-day aware).
- [x] The topic appears in Upcoming today and in Due now tomorrow.

### F-07 Revision flow
- [x] "Revise" is available on `COMPLETED`/`MASTERED` topics with no open activity.
- [x] If a recall prompt exists, it shows first; links and description are hidden until Reveal.
- [x] End shows a grade picker with Forgot / Hard / Good and the resulting next-due date for each.
- [x] Schedule updates exactly per §6.4; early revisions flagged and handled per §6.4.
- [x] After a Good at the last step the topic shows "Mastered" and leaves revision lists; "Pull back" restarts at step 0, due tomorrow.

### F-08 Scheduler + streak (pure functions in `packages/shared`)
Unit tests must include:
- [x] Brief example: step 1 due day 10, revised day 14, Good → due day 21.
- [x] All-Good lifecycle: +1, +3, +7, +16, +35, +90, +180 → Mastered.
- [x] Hard keeps the step; Forgot resets to step 0 and increments forgotCount.
- [x] Early Good/Hard → no change; early Forgot → reset.
- [x] `studyDay` with `dayStartHour = 4`: 01:30 counts as the previous day.
- [x] Current streak not broken if today doesn't qualify yet; broken if yesterday didn't qualify.
- [x] Longest streak across gaps.

### F-09 Field header
- [x] Shows Total, Learning, Revision time (h m), counts Completed / In progress / Mastered, Recall % (or "–").
- [x] Includes the live running segment; updates after every timer action.

### F-10 Tabs with counts
- [x] Ongoing (n), All Topics (n), Revised (n), Revisions (due-now count), History. Counts exclude archived topics.
- [x] Ongoing lists both in-progress learnings and revisions, tagged by type.
- [x] Revised lists topics with revisionCount ≥ 1 with last revised date, step "k/7" and next due.
- [x] Revisions shows Due now (capped at `dailyRevisionCap`, "+N more" expander, overdue labels) and Upcoming (next 2 days).
- [x] All Topics shows "Not yet" for never-revised completed topics.

### F-11 Search and sort
- [x] Case-insensitive name search (substring, so prefixes like `SW -` work), debounced 200 ms.
- [x] Sort by Added date or Completed date, asc/desc (never-completed topics sort last).
- [x] Status filter: All / Not started / In progress / Completed / Mastered.
- [x] Available on All Topics and Revised tabs.

### F-12 Topic drawer + timeline
- [x] Opens from any topic row; edits save inline.
- [x] Timeline lists learning and each revision newest-first: date, duration, grade, early flag, step; expandable segments.
- [x] Learning and revision entries are visually distinct (colour + label).

### F-13 History tab
- [x] Lists completed and in-progress activities in the field, newest first.
- [x] Filters: type (All/Learning/Revision), grade, date range (from/to), topic name search; combinable.
- [x] Clicking a row opens the topic drawer.

### F-14 Landing page
- [x] Grid of active fields with name, colour, total time, completed/total topics.
- [x] Badges: ▶ Running (tile border highlighted, pulsing), ⏸ Paused, "N due", "N upcoming" (hidden at zero).
- [x] "+ New field" button; "Show archived" toggle.
- [x] Empty state guides the user to create their first field.

### F-15 Streak card
- [x] Current 🔥 and longest streak per §6.8.
- [x] Dropdown switches Heatmap ⇄ Calendar (ticks); choice saved in settings.
- [x] Heatmap: 53 weeks, 5 intensity levels per §6.10, tooltip with minutes and completions.
- [x] Ticks: month grid with ✓ on qualifying days, today highlighted, prev/next month navigation.

### F-16 Timer bar
- [x] Visible on all pages while any activity is in progress: topic, field, type, live elapsed (HH:MM:SS), Pause/Resume, End.
- [x] If several are paused, it shows the running one, or else the most recently paused, plus "+N paused".

### F-17 Export
- [x] Profile → Export downloads `study-tracker-YYYY-MM-DD.json` containing all tables and a schema version.

---

## Phase 2 acceptance criteria

### F-20 Edit time segments
- [x] Each finished session in the topic timeline has **Edit** (start/end pickers) and **Remove**.
- [x] Server rejects end ≤ start, an end in the future, and any overlap with another session (one timer app-wide).
- [x] The activity's total is recomputed and edited sessions are marked "(edited)". Scheduling is not re-run.
- [x] The running session can't be edited (pause first); an activity's last session can't be removed.

### F-21 Settings page
- [x] Profile → Revision settings: intervals (whole days, strictly increasing, "Default" reset), day-start hour, daily cap, long-session minutes.
- [x] Changes apply from each topic's next revision; history is not rewritten.

### F-22 JSON import
- [x] Profile → Import from JSON… reads an export file, shows its counts and asks for confirmation before replacing everything.
- [x] Import runs in one transaction: an invalid file changes nothing. Export → import round-trips exactly.
- [x] Request size limit raised to 50 MB for large backups.

### F-23 Cancel a revision
- [x] "Discard revision" on the recall card and grade picker (two-click confirm) deletes the in-progress revision: nothing is recorded and the schedule is unchanged.
- [x] Only in-progress revisions can be discarded, not learning sessions or finished revisions.

### F-36 "No revision needed"
For topics worth studying once (intros, overviews, talks). Rules in REQUIREMENTS §6.5a.
- [x] Checkbox when adding or editing a topic; toggle button in the topic panel; "Not needed" button on each row of the Revisions tab.
- [x] A skipped topic completes without a due date, never appears in Due now / Upcoming or the tile counts, and still counts as completed.
- [x] Revising it anyway is logged as practice: no schedule change, no effect on recall rate.
- [x] Turning revisions back on schedules the first one for tomorrow.

## Phase 2: UI polish

### F-27 Clear hover and press states
Problem: ghost buttons (Edit, Archive, Delete, Profile chip) only darken slightly on hover, which is hard to see. Tailwind v4 also gives `<button>` the default arrow cursor.
- [x] Every clickable element shows `cursor: pointer` (global base rule for `button`, `[role=tab]`, `summary`, `select`).
- [x] Ghost buttons: hover → indigo tint (`bg-indigo-50 text-indigo-700`); destructive ghost (Delete) → `bg-rose-50 text-rose-700`.
- [x] Secondary buttons: hover → indigo border and text, not just a lighter grey.
- [x] Primary/success/danger buttons: one shade lighter on hover plus a subtle press state (`active:scale-[0.98]`).
- [x] Profile chip in the header: indigo-tinted pill on hover.
- [x] Field tiles: hover → indigo border, raised shadow, 2px lift; Running/Paused tiles keep their green/amber ring.
- [x] Topic rows, revision rows, history rows: indigo-tinted row background on hover, so the whole row reads as clickable.
- [x] Tabs: hover shows a grey underline and darker text; the active tab stays indigo.
- [x] Colour-swatch, link chips, calendar arrows and drawer close button get visible hover states.
- [x] Hover colours are defined once (Button variants + a few shared classes), not repeated per component, and all have dark-mode equivalents (F-28).

### F-28 Dark mode
- [x] One-click ☀ / ☾ toggle in the header (Light ⇄ Dark). A first visit with nothing saved matches the OS appearance. A separate "System" option was dropped: on a dark-mode Mac it looked identical to Dark.
- [x] Dark palette is a neutral charcoal (not navy) with soft accent washes for badges and highlights; solid buttons keep their colours.
- [x] Choice saved per browser in `localStorage` (a display preference, not study data) and applied by an inline script in `index.html` before first paint, so there's no white flash.
- [x] Implemented by remapping the colour palette under a `.dark` class in `index.css` (light tints → dark tints, dark text → light text), plus a `surface` token for cards and inputs and a `dark:` variant via `@custom-variant`. Components keep using ordinary Tailwind classes, so new screens get dark mode for free.
- [x] Heatmap uses a dark palette (empty cells dark grey, green levels still distinguishable); badges, toasts, modals, drawer, timer bar, inputs, date pickers (`color-scheme: dark`) all readable.
- [ ] Contrast for body text ≥ 4.5:1 in both themes (checked by eye, not measured yet).

### F-29 Compact month calendar
Problem: the Calendar view uses large square cells and is much taller than the heatmap.
- [x] Same height as the heatmap view (~7 rows of small cells), so switching views doesn't make the page jump.
- [x] Shows the **current month plus the previous 2 months side by side** (stacked on narrow screens), with prev/next navigation moving one month.
- [x] Small cells (~22px): qualifying days filled green instead of a ✓ glyph, day number in small text, today outlined, future days faded.
- [x] Same tooltip as the heatmap (date, minutes, learned/revised counts) and a per-month "N study days" count.
