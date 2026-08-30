# Tidy Tube 🧹📺

A small, kid-safe YouTube player that filters out **AI slop** — mass-produced,
low-effort, algorithm-bait content — before it ever reaches the results grid.

Built for a parent who wants their kids to search and watch YouTube videos
without wading through AI-generated "storytime" spam, emoji-clickbait
compilations, and keyword-stuffed farm channels.

## How filtering works

Every search result is scored by an explainable, heuristic filter
(`src/aiSlopFilter.js`) — **no external AI calls, no black box**. Signals
include:

- Emoji-spam titles, ALL-CAPS shouting, repeated `!!!`/`???`
- Clickbait phrasing ("you won't believe...", "must watch...")
- Explicit AI-generation disclosures in the title/description (ironically,
  many slop channels advertise this)
- Auto-generated-looking channel names (`KidsFunTV38217`) and known
  low-effort channel name patterns
- Hashtag stuffing and repeated-keyword-stuffed descriptions
- A parent-editable list of blocked keywords

Each video gets a score and a list of human-readable reasons. Videos scoring
**0** are shown to kids immediately. Videos above the configurable
**threshold** are filtered out; anything in between is "borderline" and held
back from the kid view but visible to a parent for review.

A parent can also **allowlist** or **blocklist** specific channels by ID,
which always overrides the heuristic score.

This runs *on top of* YouTube's own `safeSearch=strict` and
`videoEmbeddable=true` API filters — it's an extra layer, not a replacement
for platform-level Restricted Mode.

## Running it

Requires Node.js 18+ (uses the built-in `fetch` and `node:test` — **zero npm
dependencies**).

```bash
cp .env.example .env
# edit .env and set YOUTUBE_API_KEY (see below)
npm start
# open http://localhost:3000
```

### Getting a YouTube API key

1. Create a project at the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **YouTube Data API v3**.
3. Create an API key under *APIs & Services → Credentials*.
4. Restrict it (HTTP referrer or IP) before using it anywhere but localhost.

⚠️ **Quota note:** each search costs 100 units against the default
10,000-units/day free quota — about 100 searches/day. The server caches
identical search queries for 5 minutes to help stretch that.

## Using it

- Kids search and click a thumbnail to play — only videos that passed the
  filter are shown.
- **👪 Parent Zone** is gated behind a simple arithmetic prompt (not real
  security, just enough friction to keep a kid from wandering in). From
  there a parent can:
  - Adjust the AI-slop sensitivity threshold
  - See exactly which videos were filtered out of the last search, and why
  - Allow or block individual channels going forward
  - Manage the current allow/block lists

## Project layout

```
server.js              Zero-dependency HTTP server (routing, static files)
src/youtubeClient.js    YouTube Data API v3 search wrapper
src/aiSlopFilter.js     The heuristic filter (pure functions, unit tested)
src/listsStore.js       Reads/writes config/lists.json (parent settings)
config/lists.json       Threshold + allow/block lists (parent-editable)
public/                 Frontend: index.html, app.js, styles.css
test/                   node:test unit tests for the filter
```

## Testing

```bash
npm test
```

Runs the filter's unit tests (no API key or network access required —
they exercise `src/aiSlopFilter.js` directly against hand-crafted examples).

## Tuning the filter

`src/aiSlopFilter.js` exports its phrase/keyword lists and scoring weights
as plain constants at the top of the file — adjust them there if a
particular pattern of slop keeps slipping through, or a legitimate channel
keeps getting mis-flagged (though allowlisting that channel from the Parent
Zone is usually the faster fix).
