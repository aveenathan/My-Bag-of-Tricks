'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const vaultStore = require('../src/vaultStore');

// Every vaultStore function takes an explicit vaultDir, so tests point at a
// throwaway temp directory instead of the real vault — no snapshot/restore
// dance needed, and no risk to real notes.
let vaultDir;

test.beforeEach(() => {
  vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'performa-vault-test-'));
});

test.afterEach(() => {
  fs.rmSync(vaultDir, { recursive: true, force: true });
});

test('listTopics on a missing/empty vault dir returns []', () => {
  assert.deepEqual(vaultStore.listTopics(vaultDir), []);
  assert.deepEqual(vaultStore.listTopics(path.join(vaultDir, 'does-not-exist')), []);
});

test('createTopic writes a file with frontmatter and an empty Notes/Tasks skeleton', () => {
  const topic = vaultStore.createTopic({ title: 'Systems Thinking' }, vaultDir);
  assert.equal(topic.slug, 'systems-thinking');
  assert.equal(topic.title, 'Systems Thinking');
  assert.match(topic.body, /## Notes/);
  assert.match(topic.body, /## Tasks/);
  assert.ok(fs.existsSync(path.join(vaultDir, 'systems-thinking.md')));

  assert.throws(() => vaultStore.createTopic({ title: 'Systems Thinking' }, vaultDir), /already exists/);
  assert.throws(() => vaultStore.createTopic({ title: '   ' }, vaultDir), /title is required/);
});

test('resolveTopic finds an existing topic by slug or title, and can create one', () => {
  vaultStore.createTopic({ title: 'Systems Thinking' }, vaultDir);

  assert.equal(vaultStore.resolveTopic('systems-thinking', {}, vaultDir).slug, 'systems-thinking');
  assert.equal(vaultStore.resolveTopic('Systems Thinking', {}, vaultDir).slug, 'systems-thinking');
  assert.equal(vaultStore.resolveTopic('Cooking', {}, vaultDir), null);

  const created = vaultStore.resolveTopic('Cooking', { createIfMissing: true }, vaultDir);
  assert.equal(created.slug, 'cooking');
});

test('appendEntry files ideas/examples under Notes and tasks under Tasks', () => {
  vaultStore.createTopic({ title: 'Systems Thinking' }, vaultDir);

  vaultStore.appendEntry('systems-thinking', {
    type: 'example',
    text: "Van Halen's brown M&Ms clause caught unread contracts.",
  }, vaultDir);
  const withTask = vaultStore.appendEntry('systems-thinking', {
    type: 'task',
    text: 'Find more canary-signal examples',
  }, vaultDir);

  assert.match(withTask.body, /brown M&Ms/);
  assert.equal(withTask.tasks.length, 1);
  assert.equal(withTask.tasks[0].text.includes('canary-signal examples'), true);
  assert.equal(withTask.tasks[0].completed, false);
});

test('appendEntry throws for an unknown topic', () => {
  assert.throws(() => vaultStore.appendEntry('nope', { type: 'idea', text: 'x' }, vaultDir), /Topic not found/);
});

test('toggleTask flips a checkbox and bumps updated', async () => {
  vaultStore.createTopic({ title: 'Systems Thinking' }, vaultDir);
  const withTask = vaultStore.appendEntry('systems-thinking', { type: 'task', text: 'Do the thing' }, vaultDir);
  const before = withTask.updated;

  await new Promise((r) => setTimeout(r, 5));
  const toggled = vaultStore.toggleTask('systems-thinking', 0, vaultDir);
  assert.equal(toggled.tasks[0].completed, true);

  const toggledBack = vaultStore.toggleTask('systems-thinking', 0, vaultDir);
  assert.equal(toggledBack.tasks[0].completed, false);
  assert.ok(toggledBack.updated >= before);
});

test('writeRaw overwrites the body while preserving unset frontmatter fields', () => {
  const topic = vaultStore.createTopic({ title: 'Systems Thinking', tags: ['feedback'] }, vaultDir);
  const edited = topic.raw.replace('## Notes', '## Notes\n\n- hand-edited in Obsidian');
  const result = vaultStore.writeRaw('systems-thinking', edited, vaultDir);
  assert.match(result.body, /hand-edited in Obsidian/);
  assert.deepEqual(result.tags, ['feedback']);
});

test('deleteTopic removes the file', () => {
  vaultStore.createTopic({ title: 'Temp' }, vaultDir);
  assert.equal(vaultStore.deleteTopic('temp', vaultDir), true);
  assert.equal(vaultStore.deleteTopic('temp', vaultDir), false);
  assert.equal(vaultStore.readTopic('temp', vaultDir), null);
});
