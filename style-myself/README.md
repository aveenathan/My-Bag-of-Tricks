# Style Myself 🪞👗

Take a selfie, drop in some photos of dresses, and see how you'd look in
them — right in your browser.

This is a standalone project living in its own folder (`style-myself/`)
alongside other apps in this repo — it doesn't touch or depend on any of
them.

## Two ways to try things on

**Quick Try-On** (default, always available, zero setup)
Your selfie and dress photos never leave your browser. Pick a dress and
drag it into place over your photo: drag to move, the corner handle to
resize, the top handle to rotate. Hit **✨ Auto-fit** for a starting
position — on browsers that support the Shape Detection API (e.g. Chrome)
it detects your face and estimates a sensible shoulder width and neckline;
elsewhere it falls back to a reasonable default you can adjust by hand.
Save a look to build up a side-by-side gallery, and download any of them.

**✨ AI Blend** (optional, needs an API key)
Sends your selfie and the selected dress photo to OpenAI's `gpt-image-1`
model, which renders a single realistic composite — same person, same
pose, wearing the garment from the dress photo. This makes a real network
call with your images, so it's opt-in per click, and clearly disabled in
the UI when no key is configured.

## Running it

Requires Node.js 18+ (built-in `fetch`/`FormData` and `node:test` —
**zero npm dependencies**).

```bash
cd style-myself
cp .env.example .env
# optionally edit .env and set OPENAI_API_KEY to enable AI Blend
npm start
# open http://localhost:3000
```

Quick Try-On works immediately with no key. AI Blend shows a note
explaining it needs `OPENAI_API_KEY` until one is set.

### Getting an OpenAI API key (optional)

1. Create a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Put it in `.env` as `OPENAI_API_KEY`.
3. Image generation is billed per-call by OpenAI — check their current
   pricing before heavy use.

## Using it

1. **Your photo** — use your camera or upload a photo.
2. **Dress photos** — add one or more; photos on a plain background fit
   best. Click a thumbnail to make it the active dress.
3. **Fit it** — drag, resize, and rotate the dress over your photo, or hit
   Auto-fit for a starting point. Save looks to compare dresses side by
   side, or click AI Blend for a more realistic render.

## Privacy

- **Quick Try-On** does everything in canvas/DOM in your browser. Nothing
  is uploaded.
- **AI Blend** sends your selfie and the chosen dress photo to OpenAI's
  API only when you click "Generate with AI" — never automatically.
- The server itself doesn't persist any images to disk; everything lives
  in the browser tab's memory for the session.

## Project layout

```
server.js              Zero-dependency HTTP server (static files + /api routes)
src/imageUtils.js       Data-URL parsing/validation + prompt building (pure, unit tested)
src/openaiClient.js     Thin wrapper around OpenAI's images/edits API
public/                 Frontend: index.html, app.js, styles.css
test/                   node:test unit tests
```

## Testing

```bash
npm test
```

Runs unit tests against `src/imageUtils.js` and `src/openaiClient.js`
(the latter with a mocked `fetch`) — no API key or network access
required.
