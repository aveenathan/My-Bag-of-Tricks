'use strict';

// Pure note validation, search, and sorting logic — no I/O, easy to unit test.

/**
 * Normalize + validate the fields of a note. `requireTitle` is true for
 * creation; for a patch, only present fields are checked (an explicitly
 * empty title is still rejected).
 */
function sanitizeNoteFields(fields, { requireTitle }) {
  const out = {};

  if ('title' in fields || requireTitle) {
    const title = typeof fields.title === 'string' ? fields.title.trim() : '';
    if (!title) throw new Error('Note title is required.');
    out.title = title;
  }

  if ('body' in fields) {
    out.body = typeof fields.body === 'string' ? fields.body : '';
  } else if (requireTitle) {
    out.body = '';
  }

  return out;
}

/** Case-insensitive substring match against title or body; empty query matches everything. */
function searchNotes(notes, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
  );
}

/** Most recently updated first. */
function sortNotesByRecency(notes) {
  return [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

module.exports = { sanitizeNoteFields, searchNotes, sortNotesByRecency };
