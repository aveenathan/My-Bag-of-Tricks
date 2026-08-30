'use strict';

const fs = require('fs');
const path = require('path');

const LISTS_PATH = path.join(__dirname, '..', 'config', 'lists.json');

const DEFAULT_LISTS = {
  threshold: 4,
  allowlistChannelIds: [],
  blocklistChannelIds: [],
  blocklistKeywords: [],
};

function readLists() {
  try {
    const raw = fs.readFileSync(LISTS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LISTS, ...parsed };
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULT_LISTS };
    throw err;
  }
}

function isValidPatch(patch) {
  if (typeof patch !== 'object' || patch === null) return false;
  if ('threshold' in patch && typeof patch.threshold !== 'number') return false;
  for (const key of ['allowlistChannelIds', 'blocklistChannelIds', 'blocklistKeywords']) {
    if (key in patch) {
      if (!Array.isArray(patch[key])) return false;
      if (!patch[key].every((v) => typeof v === 'string')) return false;
    }
  }
  return true;
}

function writeLists(patch) {
  if (!isValidPatch(patch)) {
    throw new Error('Invalid config patch shape.');
  }
  const current = readLists();
  const next = { ...current, ...patch };
  fs.writeFileSync(LISTS_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/** Move a channel from blocklist to allowlist (or vice versa), deduped. */
function moveChannel(channelId, { to }) {
  const lists = readLists();
  const withoutIt = (arr) => arr.filter((id) => id !== channelId);

  const next = {
    ...lists,
    allowlistChannelIds: withoutIt(lists.allowlistChannelIds),
    blocklistChannelIds: withoutIt(lists.blocklistChannelIds),
  };

  if (to === 'allow') next.allowlistChannelIds.push(channelId);
  if (to === 'block') next.blocklistChannelIds.push(channelId);

  fs.writeFileSync(LISTS_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

module.exports = { readLists, writeLists, moveChannel, DEFAULT_LISTS };
