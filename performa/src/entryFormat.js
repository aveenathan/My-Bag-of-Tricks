'use strict';

// Pure formatting: how a captured thought becomes a line of markdown, and
// what a brand-new topic file looks like on day one.

const ENTRY_TYPES = ['idea', 'example', 'task'];
const TYPE_LABELS = { idea: 'Idea', example: 'Example' };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeCaptureText(text) {
  const clean = (text || '').trim();
  if (!clean) throw new Error('Capture text is required.');
  return clean;
}

function sanitizeEntryType(type) {
  if (!ENTRY_TYPES.includes(type)) {
    throw new Error(`type must be one of: ${ENTRY_TYPES.join(', ')}.`);
  }
  return type;
}

/**
 * Build the markdown line + destination section for one captured entry.
 * Tasks become a checkbox under "## Tasks"; ideas/examples become a labeled
 * bullet under "## Notes".
 */
function formatEntry({ type, text }, date = todayIso()) {
  const cleanType = sanitizeEntryType(type);
  const cleanText = sanitizeCaptureText(text);

  if (cleanType === 'task') {
    return { section: 'Tasks', line: `- [ ] (${date}) ${cleanText}` };
  }
  const label = TYPE_LABELS[cleanType];
  return { section: 'Notes', line: `- (${date}) **${label}:** ${cleanText}` };
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The initial body (frontmatter added separately) of a freshly created topic file. */
function newTopicBody(title) {
  return `# ${title}\n\n## Notes\n\n## Tasks\n`;
}

module.exports = {
  ENTRY_TYPES,
  todayIso,
  sanitizeCaptureText,
  sanitizeEntryType,
  formatEntry,
  slugify,
  newTopicBody,
};
