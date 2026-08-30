'use strict';

// Minimal YAML-ish frontmatter for vault files — just the handful of fixed
// keys Performa needs (title, tags, created, updated). Not a general YAML
// parser; deliberately simple so a human (or Obsidian) can hand-edit it.

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Split `---\nkey: value\n---\nbody` into { data, body }. No frontmatter → { data: {}, body: raw }. */
function parseFrontmatter(raw) {
  const match = FM_RE.exec(raw);
  if (!match) return { data: {}, body: raw };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!key) continue;
    data[key] = key === 'tags'
      ? value.split(',').map((t) => t.trim()).filter(Boolean)
      : value;
  }
  return { data, body: match[2] };
}

/** Rebuild `---\nkey: value\n---\nbody` from { title, tags, created, updated } + body. */
function serializeFrontmatter(data, body) {
  const lines = ['---'];
  lines.push(`title: ${data.title || ''}`);
  lines.push(`tags: ${(data.tags || []).join(', ')}`);
  lines.push(`created: ${data.created || ''}`);
  lines.push(`updated: ${data.updated || ''}`);
  lines.push('---');
  return `${lines.join('\n')}\n\n${body.replace(/^\n+/, '')}`;
}

module.exports = { parseFrontmatter, serializeFrontmatter };
