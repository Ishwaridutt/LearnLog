# Study Tracker

A local-first study tracker for people who learn deeply, then forget. Create a **study field** (e.g. "DSA 2026"), add **topics** as you start them, time every session, and get **spaced-repetition revisions** scheduled as a queue rather than a calendar. Missed days never break the plan, and a streak calendar shows your consistency.

Works for any subject: coding interviews, exams, languages.

## Features (MVP)

- **Study fields and topics** with descriptions, any number of labelled links, and an optional *recall prompt*.
- **One global timer**: start, pause, resume, end. Starting something new auto-pauses whatever was running.
- **Spaced repetition**: revisions at 1 → 3 → 7 → 16 → 35 → 90 → 180 days, then *Mastered*. Each revision is graded **Forgot / Hard / Good**:
  - Good moves to the next step, Hard repeats the step, Forgot goes back to step 1.
  - The next interval counts from the day you **actually** revised, so being late never stacks up penalties.
- **Recall first**: revisions show your recall prompt before revealing notes and links.
- **Field page** with total / learning / revision time, recall rate, and tabs: Ongoing · All topics · Revised · Revisions (due now, capped at 5/day, plus the next 2 days) · History.
- **Streaks**: completing any topic or revision counts for the day. Current and longest streak, shown as a heatmap or a month calendar.
- **Long-session guard**: if a timer has run for 3h+, the app asks whether you forgot to stop it.
- **Archive or delete** fields and topics; **export** everything to JSON.

## Quick start

Requires Node.js 20+ (built on Node 24).

```bash
npm install
```

```bash
npm run dev
```

Open http://127.0.0.1:5173. The API runs on http://127.0.0.1:3001/api.

On first run, `npm run dev` creates the SQLite database at `data/study.db`.

> npm 11+ blocks dependency install scripts unless approved. This repo approves only Prisma's packages (`allowScripts` in `package.json`); they need their install script to download the query engine.

## Your data

- Everything is stored in `data/study.db` on your machine. The app binds to `127.0.0.1` only and makes no external network calls.
- `data/` is git-ignored, so your study history never ends up in the repository.
- Back up by copying `data/study.db`, or use **Profile → Export all data (JSON)**.

## Project structure

```
packages/shared   Scheduler, streak and study-day logic (pure functions + tests), zod schemas, API types
apps/api          NestJS + Prisma (SQLite) REST API
apps/web          React + Vite + Tailwind CSS UI
docs/             Requirements and feature list
```

The scheduling rules live in [`packages/shared/src/scheduler.ts`](packages/shared/src/scheduler.ts). The API uses them to write state, and the UI uses them to preview "next due if you grade Good/Hard/Forgot".

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Build shared, migrate DB, run API + web with reload |
| `npm test` | Scheduler and streak unit tests |
| `npm run typecheck` | Typecheck all packages |
| `npm run build` | Production build of all packages |

Set `API_PORT` to run the API on a port other than 3001; the web dev server proxies `/api` to 3001, so update `apps/web/vite.config.ts` too if you do.

## Docs

- [Requirements](docs/REQUIREMENTS.md): problem, metrics, data model, exact scheduling rules
- [Feature list](docs/FEATURES.md): MVP acceptance criteria and roadmap

## Roadmap

Phase 2: edit logged time, settings page (intervals, daily cap, day-start hour), JSON import, cancel a revision.
Phase 3: weak-topics list, target date and pace indicator, per-field intervals.
Phase 4: cross-field Today view, weekly review, desktop app.
