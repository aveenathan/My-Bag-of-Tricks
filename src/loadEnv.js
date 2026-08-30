'use strict';

const fs = require('fs');

/**
 * Minimal, dependency-free ".env" loader.
 *
 * Populates process.env from a simple KEY=VALUE file, one assignment per
 * line. Lines starting with # (after trimming) are comments; blank lines
 * are ignored; surrounding single or double quotes on the value are
 * stripped. Existing process.env values are never overwritten — real
 * environment variables (e.g. set by a hosting platform) always win over
 * whatever is in the file.
 *
 * Silently does nothing if the file doesn't exist — .env is optional
 * (the app falls back to demo mode without YOUTUBE_API_KEY set).
 */
function loadEnvFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (isQuoted) value = value.slice(1, -1);

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

module.exports = { loadEnvFile };
