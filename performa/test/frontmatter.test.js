'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseFrontmatter, serializeFrontmatter } = require('../src/frontmatter');

test('parseFrontmatter extracts fields and splits tags on comma', () => {
  const raw = '---\ntitle: Systems Thinking\ntags: systems, feedback\ncreated: 2026-08-01\nupdated: 2026-08-30\n---\n\n# Systems Thinking\n\nbody text\n';
  const { data, body } = parseFrontmatter(raw);
  assert.equal(data.title, 'Systems Thinking');
  assert.deepEqual(data.tags, ['systems', 'feedback']);
  assert.equal(data.created, '2026-08-01');
  assert.equal(data.updated, '2026-08-30');
  assert.match(body, /^\n# Systems Thinking/);
});

test('parseFrontmatter returns empty data for a file with no frontmatter', () => {
  const { data, body } = parseFrontmatter('# Just a heading\n\nsome text\n');
  assert.deepEqual(data, {});
  assert.equal(body, '# Just a heading\n\nsome text\n');
});

test('parseFrontmatter handles an empty tags line as an empty array', () => {
  const raw = '---\ntitle: Foo\ntags: \ncreated: 2026-08-01\nupdated: 2026-08-01\n---\nbody\n';
  const { data } = parseFrontmatter(raw);
  assert.deepEqual(data.tags, []);
});

test('serializeFrontmatter + parseFrontmatter round-trip', () => {
  const data = { title: 'My Topic', tags: ['a', 'b'], created: '2026-08-01', updated: '2026-08-30' };
  const body = '# My Topic\n\n## Notes\n\n- an idea\n';
  const raw = serializeFrontmatter(data, body);
  const parsed = parseFrontmatter(raw);
  assert.deepEqual(parsed.data, data);
  assert.match(parsed.body, /## Notes/);
});
