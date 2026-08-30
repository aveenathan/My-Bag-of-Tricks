'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeTaskFields, sortTasks, isOverdue, tasksForToday } = require('../src/taskLogic');

test('sanitizeTaskFields requires a non-empty title on create', () => {
  assert.throws(() => sanitizeTaskFields({}, { requireTitle: true }), /title is required/);
  assert.throws(() => sanitizeTaskFields({ title: '   ' }, { requireTitle: true }), /title is required/);
  const clean = sanitizeTaskFields({ title: '  Buy milk  ' }, { requireTitle: true });
  assert.equal(clean.title, 'Buy milk');
});

test('sanitizeTaskFields allows an empty patch (no title required)', () => {
  assert.deepEqual(sanitizeTaskFields({}, { requireTitle: false }), {});
});

test('sanitizeTaskFields validates dueDate format', () => {
  assert.equal(sanitizeTaskFields({ dueDate: null }, { requireTitle: false }).dueDate, null);
  assert.equal(sanitizeTaskFields({ dueDate: '' }, { requireTitle: false }).dueDate, null);
  assert.equal(sanitizeTaskFields({ dueDate: '2026-09-01' }, { requireTitle: false }).dueDate, '2026-09-01');
  assert.throws(() => sanitizeTaskFields({ dueDate: 'not-a-date' }, { requireTitle: false }), /valid YYYY-MM-DD/);
});

test('sanitizeTaskFields validates priority and completed', () => {
  assert.throws(() => sanitizeTaskFields({ priority: 'urgent' }, { requireTitle: false }), /priority must be one of/);
  assert.equal(sanitizeTaskFields({ priority: 'high' }, { requireTitle: false }).priority, 'high');
  assert.throws(() => sanitizeTaskFields({ completed: 'yes' }, { requireTitle: false }), /completed must be a boolean/);
  assert.equal(sanitizeTaskFields({ completed: true }, { requireTitle: false }).completed, true);
});

function makeTask(overrides) {
  return {
    id: Math.random().toString(36),
    title: 'task',
    dueDate: null,
    priority: 'medium',
    completed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('sortTasks puts active tasks before completed ones', () => {
  const done = makeTask({ title: 'done', completed: true });
  const active = makeTask({ title: 'active', completed: false });
  const sorted = sortTasks([done, active]);
  assert.deepEqual(sorted.map((t) => t.title), ['active', 'done']);
});

test('sortTasks orders by due date, then priority, then creation order', () => {
  const noDate = makeTask({ title: 'no-date' });
  const later = makeTask({ title: 'later', dueDate: '2026-09-05' });
  const soonLow = makeTask({ title: 'soon-low', dueDate: '2026-09-01', priority: 'low' });
  const soonHigh = makeTask({ title: 'soon-high', dueDate: '2026-09-01', priority: 'high' });

  const sorted = sortTasks([noDate, later, soonLow, soonHigh]);
  assert.deepEqual(sorted.map((t) => t.title), ['soon-high', 'soon-low', 'later', 'no-date']);
});

test('isOverdue flags only active, past-due tasks', () => {
  assert.equal(isOverdue(makeTask({ dueDate: '2026-08-01' }), '2026-08-30'), true);
  assert.equal(isOverdue(makeTask({ dueDate: '2026-08-30' }), '2026-08-30'), false);
  assert.equal(isOverdue(makeTask({ dueDate: '2026-08-01', completed: true }), '2026-08-30'), false);
  assert.equal(isOverdue(makeTask({ dueDate: null }), '2026-08-30'), false);
});

test('tasksForToday includes due-today and overdue active tasks only', () => {
  const overdue = makeTask({ title: 'overdue', dueDate: '2026-08-01' });
  const dueToday = makeTask({ title: 'due-today', dueDate: '2026-08-30' });
  const future = makeTask({ title: 'future', dueDate: '2026-09-01' });
  const doneOverdue = makeTask({ title: 'done', dueDate: '2026-08-01', completed: true });
  const noDate = makeTask({ title: 'no-date' });

  const result = tasksForToday([overdue, dueToday, future, doneOverdue, noDate], '2026-08-30');
  assert.deepEqual(result.map((t) => t.title).sort(), ['due-today', 'overdue']);
});
