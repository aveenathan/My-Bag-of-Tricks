'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseDataUrl,
  validateImageDataUrl,
  buildTryOnPrompt,
  DEFAULT_INSTRUCTIONS,
} = require('../src/imageUtils');

// A 1x1 transparent PNG, base64-encoded — small enough to embed inline.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const TINY_PNG = `data:image/png;base64,${TINY_PNG_BASE64}`;

test('parseDataUrl extracts mime and base64 payload', () => {
  const { mime, base64 } = parseDataUrl(TINY_PNG);
  assert.equal(mime, 'image/png');
  assert.equal(base64, TINY_PNG_BASE64);
});

test('parseDataUrl rejects non-data-URL strings', () => {
  assert.throws(() => parseDataUrl('not a data url'), /base64-encoded data URL/);
  assert.throws(() => parseDataUrl(''), /non-empty/);
  assert.throws(() => parseDataUrl(undefined), /non-empty/);
});

test('validateImageDataUrl accepts a small PNG', () => {
  const { mime, buffer } = validateImageDataUrl(TINY_PNG, { label: 'selfie' });
  assert.equal(mime, 'image/png');
  assert.ok(buffer.length > 0);
});

test('validateImageDataUrl rejects disallowed mime types', () => {
  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg></svg>').toString('base64')}`;
  assert.throws(() => validateImageDataUrl(svg), /Unsupported .* type/);
});

test('validateImageDataUrl rejects payloads over the byte ceiling', () => {
  const bigBase64 = Buffer.alloc(200).fill(1).toString('base64');
  const dataUrl = `data:image/png;base64,${bigBase64}`;
  assert.throws(() => validateImageDataUrl(dataUrl, { maxBytes: 50 }), /too large/);
});

test('buildTryOnPrompt falls back to default instructions with no note', () => {
  assert.equal(buildTryOnPrompt(), DEFAULT_INSTRUCTIONS);
  assert.equal(buildTryOnPrompt(''), DEFAULT_INSTRUCTIONS);
  assert.equal(buildTryOnPrompt('   '), DEFAULT_INSTRUCTIONS);
});

test('buildTryOnPrompt appends a cleaned, length-capped styling note', () => {
  const prompt = buildTryOnPrompt('  studio   lighting\nplease  ');
  assert.match(prompt, /^Take the person/);
  assert.match(prompt, /Additional styling note: studio lighting please$/);

  const long = 'x'.repeat(500);
  const capped = buildTryOnPrompt(long);
  assert.equal(capped.length, DEFAULT_INSTRUCTIONS.length + ' Additional styling note: '.length + 300);
});
