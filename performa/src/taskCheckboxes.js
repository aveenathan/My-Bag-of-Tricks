'use strict';

// Global (whole-file, not section-scoped) checkbox scanning/toggling. Kept
// section-agnostic so a checkbox a human added anywhere in the file — not
// just under "## Tasks" — still shows up and can be toggled from the UI.

const CHECKBOX_RE = /^(\s*-\s*\[)( |x|X)(\]\s*)(.*)$/;

/** [{ index, text, completed }] in document order. */
function listCheckboxes(raw) {
  const items = [];
  raw.split(/\r?\n/).forEach((line) => {
    const match = CHECKBOX_RE.exec(line);
    if (match) {
      items.push({ index: items.length, text: match[4], completed: match[2].toLowerCase() === 'x' });
    }
  });
  return items;
}

/** Flip the nth checkbox (0-based, in document order) between [ ] and [x]. */
function toggleCheckbox(raw, index) {
  let seen = -1;
  let found = false;
  const next = raw.split(/\r?\n/).map((line) => {
    const match = CHECKBOX_RE.exec(line);
    if (!match) return line;
    seen += 1;
    if (seen !== index) return line;
    found = true;
    const flipped = match[2].toLowerCase() === 'x' ? ' ' : 'x';
    return `${match[1]}${flipped}${match[3]}${match[4]}`;
  });
  if (!found) throw new Error(`No checkbox at index ${index}.`);
  return next.join('\n');
}

module.exports = { listCheckboxes, toggleCheckbox };
