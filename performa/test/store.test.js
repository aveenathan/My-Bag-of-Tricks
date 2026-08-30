'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const store = require('../src/store');

// store.js persists to a real file on disk; snapshot it and restore afterward
// so running the test suite never clobbers real data.
let hadFile = false;
let original = null;

test.before(() => {
  hadFile = fs.existsSync(store.DATA_PATH);
  if (hadFile) original = fs.readFileSync(store.DATA_PATH, 'utf8');
});

test.after(() => {
  if (hadFile) fs.writeFileSync(store.DATA_PATH, original, 'utf8');
  else fs.rmSync(store.DATA_PATH, { force: true });
});

test.beforeEach(() => {
  fs.rmSync(store.DATA_PATH, { force: true });
});

test('createTask + listTasks round-trip, updateTask patches fields, deleteTask removes it', () => {
  const created = store.createTask({ title: 'Write tests', priority: 'high' });
  assert.equal(created.title, 'Write tests');
  assert.equal(created.completed, false);

  assert.deepEqual(store.listTasks().map((t) => t.id), [created.id]);

  const updated = store.updateTask(created.id, { completed: true });
  assert.equal(updated.completed, true);
  assert.equal(store.updateTask('missing-id', { completed: true }), null);

  assert.equal(store.deleteTask(created.id), true);
  assert.equal(store.deleteTask(created.id), false);
  assert.deepEqual(store.listTasks(), []);
});

test('listTasksForToday only returns active tasks due today or earlier', () => {
  store.createTask({ title: 'future', dueDate: '2099-01-01' });
  const todayTask = store.createTask({ title: 'today', dueDate: '2020-01-01' });

  const due = store.listTasksForToday('2026-08-30');
  assert.deepEqual(due.map((t) => t.id), [todayTask.id]);
});

test('createNote + listNotes round-trip, updateNote bumps updatedAt, deleteNote removes it', async () => {
  const created = store.createNote({ title: 'Idea', body: 'Build a thing' });
  assert.equal(created.title, 'Idea');

  assert.deepEqual(store.listNotes().map((n) => n.id), [created.id]);
  assert.deepEqual(store.listNotes('idea').map((n) => n.id), [created.id]);
  assert.deepEqual(store.listNotes('nope'), []);

  await new Promise((r) => setTimeout(r, 5));
  const updated = store.updateNote(created.id, { body: 'Build a better thing' });
  assert.equal(updated.body, 'Build a better thing');
  assert.notEqual(updated.updatedAt, created.updatedAt);
  assert.equal(store.updateNote('missing-id', { body: 'x' }), null);

  assert.equal(store.deleteNote(created.id), true);
  assert.equal(store.deleteNote(created.id), false);
  assert.deepEqual(store.listNotes(), []);
});
