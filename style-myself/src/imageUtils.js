'use strict';

// Pure helpers for handling the base64 image data URLs the frontend sends up.
// Kept dependency-free and side-effect-free so they're easy to unit test.

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const DATA_URL_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/;

/**
 * Split a `data:<mime>;base64,<payload>` string into its parts.
 * Throws a descriptive Error if the string isn't a well-formed base64 data URL.
 */
function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) {
    throw new Error('Expected a non-empty data URL string.');
  }
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) {
    throw new Error('Expected a base64-encoded data URL (data:<mime>;base64,...).');
  }
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

/**
 * Parse + validate an image data URL: allowed MIME type and a byte-size ceiling.
 * Returns { mime, buffer } on success; throws on anything invalid.
 */
function validateImageDataUrl(dataUrl, { maxBytes = 10 * 1024 * 1024, label = 'image' } = {}) {
  const { mime, base64 } = parseDataUrl(dataUrl);
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    throw new Error(`Unsupported ${label} type "${mime}". Use PNG, JPEG, or WEBP.`);
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    throw new Error(`The ${label} appears to be empty.`);
  }
  if (buffer.length > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`The ${label} is too large — keep it under ${mb}MB.`);
  }
  return { mime, buffer };
}

const DEFAULT_INSTRUCTIONS =
  'Take the person from the first photo and the garment from the second photo. ' +
  'Show the same person, with the same face, body shape, pose, and background, ' +
  'now wearing the garment from the second photo. Match the garment\'s color, ' +
  'pattern, and silhouette closely, and render realistic fabric folds and lighting ' +
  'consistent with the original photo.';

const MAX_STYLE_NOTE_LENGTH = 300;

/**
 * Build the prompt sent to the image model: fixed instructions plus an optional,
 * length-capped, single-line styling note from the user.
 */
function buildTryOnPrompt(userNote) {
  if (!userNote || typeof userNote !== 'string') return DEFAULT_INSTRUCTIONS;
  const cleaned = userNote.replace(/\s+/g, ' ').trim().slice(0, MAX_STYLE_NOTE_LENGTH);
  if (!cleaned) return DEFAULT_INSTRUCTIONS;
  return `${DEFAULT_INSTRUCTIONS} Additional styling note: ${cleaned}`;
}

module.exports = {
  ALLOWED_MIME_TYPES,
  parseDataUrl,
  validateImageDataUrl,
  buildTryOnPrompt,
  DEFAULT_INSTRUCTIONS,
};
