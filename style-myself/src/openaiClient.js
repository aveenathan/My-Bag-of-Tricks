'use strict';

const { validateImageDataUrl, buildTryOnPrompt } = require('./imageUtils');

const EDITS_URL = 'https://api.openai.com/v1/images/edits';
const MODEL = 'gpt-image-1';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function extToMime(mime) {
  return mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
}

/**
 * Ask OpenAI's image model to composite the dress from `dressDataUrl` onto the
 * person in `selfieDataUrl`. Returns a `data:image/png;base64,...` string.
 *
 * Kept as a thin wrapper around fetch (Node 18+'s built-in FormData/Blob) so it
 * has no npm dependencies, matching the rest of this project.
 */
async function generateTryOn({ selfieDataUrl, dressDataUrl, styleNote, apiKey, fetchImpl = fetch }) {
  if (!apiKey) {
    throw new Error('No OpenAI API key configured.');
  }

  const selfie = validateImageDataUrl(selfieDataUrl, { maxBytes: MAX_IMAGE_BYTES, label: 'selfie' });
  const dress = validateImageDataUrl(dressDataUrl, { maxBytes: MAX_IMAGE_BYTES, label: 'dress photo' });
  const prompt = buildTryOnPrompt(styleNote);

  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', '1024x1536');
  form.append('image[]', new Blob([selfie.buffer], { type: selfie.mime }), `selfie.${extToMime(selfie.mime)}`);
  form.append('image[]', new Blob([dress.buffer], { type: dress.mime }), `dress.${extToMime(dress.mime)}`);

  const res = await fetchImpl(EDITS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : `OpenAI API responded with status ${res.status}.`;
    throw new Error(message);
  }

  const b64 = payload && payload.data && payload.data[0] && payload.data[0].b64_json;
  if (!b64) {
    throw new Error('OpenAI API response did not include an image.');
  }
  return `data:image/png;base64,${b64}`;
}

module.exports = { generateTryOn, MODEL, EDITS_URL };
