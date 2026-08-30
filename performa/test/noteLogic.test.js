'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeNoteFields, searchNotes, sortNotesByRecency } = require('../src/noteLogic');

test('sanitizeNoteFields requires a non-empty title on create, defaults body', () => {
  assert.throws(() => sanitizeNoteFields({}, { requireTitle: true }), /title is required/);
  const clean = sanitizeNoteFields({ title: '  Groceries  ' }, { requireTitle: true });
  assert.equal(clean.title, 'Groceries');
  assert.equal(clean.body, '');
});

test('sanitizeNoteFields allows an empty patch, rejects an explicit empty title', () => {
  assert.deepEqual(sanitizeNoteFields({}, { requireTitle: false }), {});
  assert.throws(() => sanitizeNoteFields({ title: '  ' }, { requireTitle: false }), /title is required/);
  assert.equal(sanitizeNoteFields({ body: 'new body' }, { requireTitle: false }).body, 'new body');
});

function makeNote(overrides) {
  return {
    id: Math.random().toString(36),
    title: 'note',
    body: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('searchNotes matches title or body case-insensitively', () => {
  const notes = [
    makeNote({ title: 'Grocery list', body: 'milk, eggs' }),
    makeNote({ title: 'Trip plan', body: 'Book flights and hotel' }),
  ];
  assert.deepEqual(searchNotes(notes, 'grocery').map((n) => n.title), ['Grocery list']);
  assert.deepEqual(searchNotes(notes, 'FLIGHTS').map((n) => n.title), ['Trip plan']);
  assert.equal(searchNotes(notes, '').length, 2);
  assert.equal(searchNotes(notes, '   ').length, 2);
  assert.equal(searchNotes(notes, 'nonexistent').length, 0);
});

test('sortNotesByRecency orders most recently updated first', () => {
  const older = makeNote({ title: 'older', updatedAt: '2026-01-01T00:00:00.000Z' });
  const newer = makeNote({ title: 'newer', updatedAt: '2026-02-01T00:00:00.000Z' });
  const sorted = sortNotesByRecency([older, newer]);
  assert.deepEqual(sorted.map((n) => n.title), ['newer', 'older']);
});
