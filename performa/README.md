# Performa 🗂️

A small personal organizer: a "what's due" Today view for quick day-to-day
todos, and a **topic vault** for everything else — ideas, examples, and
tasks that actually belong to a subject you're exploring, all aggregating
into one real markdown file per topic.

This is a standalone project living in its own folder (`performa/`)
alongside the other apps in this repo — it doesn't touch or depend on any
of them.

## Two kinds of "todo"

Not everything is a task, and not every task is a quick todo. Performa
keeps two separate things on purpose:

- **Today / Tasks** — a fast, JSON-backed list for day-to-day items with a
  due date and priority ("call the dentist"). Nothing fancier than that.
- **Topics** — a folder of real `.md` files, one per subject, where you
  capture ideas, examples, and topic-linked tasks as you run into them. An
  example, walking through the app:

  > You're reading about systems thinking and learn that Van Halen put a
  > clause banning brown M&Ms in their tour rider — not because they cared
  > about candy, but so that if they walked in and saw brown M&Ms, they'd
  > know without reading the whole document that the promoter hadn't
  > actually read their (safety-critical) contract carefully. Capture that
  > as an **Example**, and Performa suggests filing it under your existing
  > `Systems Thinking.md` — confirm, and it's appended there, not scattered
  > into a new disconnected note.

## Capturing a thought

1. Type it into the capture box on the **Topics** tab.
2. Pick what it *is*: **Idea**, **Example**, or **Task**. Ideas/examples
   become a labeled bullet under a topic's `## Notes` section; tasks
   become a real `- [ ]` checkbox under `## Tasks`.
3. As you type, Performa suggests existing topics by keyword overlap with
   their title/tags/content — check the ones that fit, or type a new topic
   name to create one on the fly. You can file the same capture under
   several topics at once.
4. Hit **Capture**. The relevant file(s) get updated on disk immediately.

Click any topic card to read it — checkboxes are interactive right there
— or hit **View raw** to see (and hand-edit) the exact file, frontmatter
included.

## Using it with Obsidian or Confluence

Every topic is a plain `.md` file with a small YAML frontmatter block
(`title`, `tags`, `created`, `updated`) followed by ordinary markdown —
nothing Performa-specific, nothing that needs Performa to read. Point an
Obsidian vault at `performa/vault/` (or copy the files into an existing
vault) and they open normally, checkboxes and all. Confluence's markdown
import handles the same files directly; it just ignores the frontmatter
it doesn't recognize.

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

- Quick tasks live in `data/store.json`.
- Topics live as individual files in `vault/` — e.g. `vault/systems-thinking.md`.

Both are gitignored: this is your content, not something the code repo
tracks. Back it up, sync it, or point Obsidian at it however you like.

## Project layout

```
server.js                Zero-dependency HTTP server (REST API + static files)
src/taskLogic.js          Quick-task validation, sorting, "due today" logic (pure, tested)
src/store.js              Reads/writes data/store.json; quick-task CRUD
src/frontmatter.js        Minimal YAML frontmatter parse/serialize (pure, tested)
src/mdSections.js         Parse/rebuild "## Heading" sections in a markdown body (pure, tested)
src/taskCheckboxes.js     Find/toggle "- [ ]" checkboxes anywhere in a file (pure, tested)
src/matching.js           No-API-key keyword heuristic for topic suggestions (pure, tested)
src/entryFormat.js        Formats a capture into a markdown line; new-topic skeleton (pure, tested)
src/vaultStore.js         Ties the above together: reads/writes vault/*.md
public/                   Frontend: index.html, app.js, styles.css
test/                     node:test unit + integration tests
```

## API

| Method | Path                          | Description                              |
|--------|-------------------------------|-------------------------------------------|
| GET    | `/api/tasks`                   | List all quick tasks, sorted for display  |
| GET    | `/api/tasks/today`             | Quick tasks due today or overdue          |
| POST   | `/api/tasks`                   | Create a quick task                       |
| PATCH  | `/api/tasks/:id`                | Update a quick task                       |
| DELETE | `/api/tasks/:id`                | Delete a quick task                       |
| GET    | `/api/topics`                   | List topics with tag/task-count summaries |
| GET    | `/api/topics/suggest?text=`     | Ranked topic suggestions for a draft capture |
| POST   | `/api/topics`                   | Create a new, empty topic file            |
| GET    | `/api/topics/:slug`              | Full topic detail (frontmatter, body, raw, tasks) |
| PUT    | `/api/topics/:slug/raw`          | Overwrite a topic's full file content     |
| PATCH  | `/api/topics/:slug/tasks/:index` | Toggle the nth checkbox in a topic file   |
| DELETE | `/api/topics/:slug`              | Delete a topic file                       |
| POST   | `/api/captures`                  | File one idea/example/task into one or more topics (existing and/or brand-new) at once |

## Testing

```bash
npm test
```

41 tests: pure-logic tests for every `src/*.js` module, plus integration
tests for `src/store.js` (snapshots and restores the real data file) and
`src/vaultStore.js` (uses a throwaway temp directory). No network access
required.
