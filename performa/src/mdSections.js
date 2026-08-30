'use strict';

// Parse a markdown body into an ordered list of `## Heading` sections (plus
// whatever comes before the first one, kept as `preamble`), and reassemble.
// Used to append a new bullet under "## Notes" or "## Tasks" without
// disturbing any other section a human (or Obsidian) has added by hand.

const HEADING_RE = /^##\s+(.+?)\s*$/;

/** { preamble, sections: [{ heading, lines }] } */
function parseSections(body) {
  const lines = body.split(/\r?\n/);
  const preamble = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = HEADING_RE.exec(line);
    if (match) {
      current = { heading: match[1], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  return { preamble: preamble.join('\n'), sections };
}

function serializeSections(preamble, sections) {
  const parts = [preamble.replace(/\n+$/, '')];
  for (const section of sections) {
    const body = section.lines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
    parts.push(`## ${section.heading}\n${body ? `\n${body}` : ''}`);
  }
  return parts.join('\n\n').replace(/\n+$/, '') + '\n';
}

/**
 * Append a line to the (case-insensitively matched) section named `heading`,
 * creating it at the end of the document if it doesn't exist yet.
 */
function appendToSection(body, heading, line) {
  const { preamble, sections } = parseSections(body);
  let section = sections.find((s) => s.heading.toLowerCase() === heading.toLowerCase());
  if (!section) {
    section = { heading, lines: [] };
    sections.push(section);
  }
  section.lines.push(line);
  return serializeSections(preamble, sections);
}

module.exports = { parseSections, serializeSections, appendToSection };
