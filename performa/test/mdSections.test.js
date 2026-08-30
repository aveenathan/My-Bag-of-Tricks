'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSections, serializeSections, appendToSection } = require('../src/mdSections');

const SAMPLE = '# Systems Thinking\n\n## Notes\n\n- existing note\n\n## Tasks\n\n- [ ] existing task\n';

test('parseSections splits preamble and headings in order', () => {
  const { preamble, sections } = parseSections(SAMPLE);
  assert.match(preamble, /# Systems Thinking/);
  assert.deepEqual(sections.map((s) => s.heading), ['Notes', 'Tasks']);
  assert.ok(sections[0].lines.join('\n').includes('existing note'));
});

test('serializeSections rebuilds a document parseSections can re-parse', () => {
  const { preamble, sections } = parseSections(SAMPLE);
  const rebuilt = serializeSections(preamble, sections);
  const reparsed = parseSections(rebuilt);
  assert.deepEqual(reparsed.sections.map((s) => s.heading), ['Notes', 'Tasks']);
});

test('appendToSection adds a line to an existing section without disturbing others', () => {
  const next = appendToSection(SAMPLE, 'Notes', '- (2026-08-30) **Example:** brown M&Ms');
  assert.match(next, /existing note/);
  assert.match(next, /brown M&Ms/);
  assert.match(next, /existing task/);
  // The new line landed in Notes, not Tasks.
  const notesIdx = next.indexOf('## Notes');
  const tasksIdx = next.indexOf('## Tasks');
  const newLineIdx = next.indexOf('brown M&Ms');
  assert.ok(newLineIdx > notesIdx && newLineIdx < tasksIdx);
});

test('appendToSection matches heading case-insensitively', () => {
  const next = appendToSection(SAMPLE, 'notes', '- lowercase heading match');
  assert.match(next, /lowercase heading match/);
  // Still only one "## Notes" heading — it didn't create a duplicate section.
  assert.equal((next.match(/## Notes/gi) || []).length, 1);
});

test('appendToSection creates a missing section at the end', () => {
  const next = appendToSection('# Title\n\n## Notes\n', 'Tasks', '- [ ] new task');
  assert.match(next, /## Tasks/);
  assert.match(next, /new task/);
});
