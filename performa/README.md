# Performa 🗂️

A small personal organizer: quick task capture, a "what's due" Today view,
and freeform notes — all in one page, no account, no sync.

This is a standalone project living in its own folder (`performa/`)
alongside the other apps in this repo — it doesn't touch or depend on any
of them.

## Features

- **Today** — a quick-add bar plus everything due today or overdue, so you
  can see what actually needs attention without scrolling a full list.
- **Tasks** — the full list, filterable by All / Active / Completed. Click
  ✎ to edit a task's title, due date, or priority in place; the checkbox
  marks it done.
- **Notes** — freeform title + body notes with instant search across both
  fields. Click ✎ to edit, or ➕ New note to add one.

## Running it

Requires Node.js 18+ (built-in `fetch`, `crypto.randomUUID`, and
`node:test` — **zero npm dependencies**).

```bash
cd performa
cp .env.example .env   # optional — only needed to change the port
npm start
# open http://localhost:3000
```

## Data

Everything is stored locally in `data/store.json`, created automatically
on first write. It's gitignored — your tasks and notes are yours, not
something this repo tracks. There's no external API, network call, or
account involved anywhere in this app.

## Project layout

```
server.js            Zero-dependency HTTP server (REST API + static files)
src/taskLogic.js      Task validation, sorting, "due today" logic (pure, unit tested)
src/noteLogic.js      Note validation, search, sorting (pure, unit tested)
src/store.js          Reads/writes data/store.json; task & note CRUD
public/               Frontend: index.html, app.js, styles.css
test/                 node:test unit + integration tests
```

## API

| Method | Path              | Description                          |
|--------|-------------------|---------------------------------------|
| GET    | `/api/tasks`       | List all tasks, sorted for display    |
| GET    | `/api/tasks/today` | Tasks due today or overdue            |
| POST   | `/api/tasks`       | Create a task                         |
| PATCH  | `/api/tasks/:id`   | Update a task (any subset of fields)  |
| DELETE | `/api/tasks/:id`   | Delete a task                         |
| GET    | `/api/notes?q=`    | List/search notes                     |
| POST   | `/api/notes`       | Create a note                         |
| PATCH  | `/api/notes/:id`   | Update a note                         |
| DELETE | `/api/notes/:id`   | Delete a note                         |

## Testing

```bash
npm test
```

Covers `src/taskLogic.js` and `src/noteLogic.js` (pure functions) plus
`src/store.js` (CRUD against the real data file, snapshotted and restored
so the suite never clobbers real data). No network access required.
