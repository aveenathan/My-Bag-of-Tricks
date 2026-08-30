'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { formatEntry, slugify, newTopicBody, sanitizeCaptureText, sanitizeEntryType } = require('../src/entryFormat');

test('sanitizeCaptureText trims and rejects empty text', () => {
  assert.equal(sanitizeCaptureText('  hello  '), 'hello');
  assert.throws(() => sanitizeCaptureText(''), /required/);
  assert.throws(() => sanitizeCaptureText('   '), /required/);
});

test('sanitizeEntryType rejects unknown types', () => {
  assert.throws(() => sanitizeEntryType('reminder'), /type must be one of/);
  assert.equal(sanitizeEntryType('task'), 'task');
});

test('formatEntry files a task as a checkbox under Tasks', () => {
  const { section, line } = formatEntry({ type: 'task', text: 'Read the contract' }, '2026-08-30');
  assert.equal(section, 'Tasks');
  assert.equal(line, '- [ ] (2026-08-30) Read the contract');
});

test('formatEntry files an idea/example as a labeled bullet under Notes', () => {
  const idea = formatEntry({ type: 'idea', text: 'Canary signals reveal hidden state' }, '2026-08-30');
  assert.equal(idea.section, 'Notes');
  assert.equal(idea.line, '- (2026-08-30) **Idea:** Canary signals reveal hidden state');

  const example = formatEntry({ type: 'example', text: "Van Halen's brown M&Ms clause" }, '2026-08-30');
  assert.equal(example.section, 'Notes');
  assert.equal(example.line, "- (2026-08-30) **Example:** Van Halen's brown M&Ms clause");
});

test('slugify turns a title into a kebab-case, filesystem-safe slug', () => {
  assert.equal(slugify('Systems Thinking'), 'systems-thinking');
  assert.equal(slugify('  Van Halen & the M&Ms!!  '), 'van-halen-the-m-ms');
  assert.equal(slugify('C++ Notes'), 'c-notes');
});

test('newTopicBody produces an H1 plus empty Notes and Tasks sections', () => {
  const body = newTopicBody('Systems Thinking');
  assert.match(body, /^# Systems Thinking/);
  assert.match(body, /## Notes/);
  assert.match(body, /## Tasks/);
});
