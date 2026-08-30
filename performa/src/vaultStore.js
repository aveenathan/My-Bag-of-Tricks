'use strict';

const fs = require('fs');
const path = require('path');

const { parseFrontmatter, serializeFrontmatter } = require('./frontmatter');
const { appendToSection } = require('./mdSections');
const { listCheckboxes, toggleCheckbox } = require('./taskCheckboxes');
const { formatEntry, slugify, newTopicBody, todayIso } = require('./entryFormat');

const DEFAULT_VAULT_DIR = path.join(__dirname, '..', 'vault');

function filePath(slug, vaultDir) {
  return path.join(vaultDir, `${slug}.md`);
}

function readFile(slug, vaultDir) {
  const raw = fs.readFileSync(filePath(slug, vaultDir), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  return { raw, data, body };
}

function writeFile(slug, data, body, vaultDir) {
  fs.mkdirSync(vaultDir, { recursive: true });
  fs.writeFileSync(filePath(slug, vaultDir), serializeFrontmatter(data, body), 'utf8');
}

/** [{ slug, title, tags, created, updated, content }] for every *.md file in the vault. */
function listTopics(vaultDir = DEFAULT_VAULT_DIR) {
  if (!fs.existsSync(vaultDir)) return [];
  return fs
    .readdirSync(vaultDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.slice(0, -3);
      const { data, body } = readFile(slug, vaultDir);
      return {
        slug,
        title: data.title || slug,
        tags: data.tags || [],
        created: data.created || '',
        updated: data.updated || '',
        content: body,
      };
    })
    .sort((a, b) => (a.updated < b.updated ? 1 : -1));
}

function topicExists(slug, vaultDir = DEFAULT_VAULT_DIR) {
  return fs.existsSync(filePath(slug, vaultDir));
}

/** Full detail for one topic, including its checkbox tasks in document order. */
function readTopic(slug, vaultDir = DEFAULT_VAULT_DIR) {
  if (!topicExists(slug, vaultDir)) return null;
  const { raw, data, body } = readFile(slug, vaultDir);
  return {
    slug,
    title: data.title || slug,
    tags: data.tags || [],
    created: data.created || '',
    updated: data.updated || '',
    body,
    raw,
    tasks: listCheckboxes(raw),
  };
}

function createTopic({ title, tags = [] }, vaultDir = DEFAULT_VAULT_DIR) {
  const clean = (title || '').trim();
  if (!clean) throw new Error('Topic title is required.');
  const slug = slugify(clean);
  if (!slug) throw new Error('Topic title must contain at least one letter or number.');
  if (topicExists(slug, vaultDir)) throw new Error(`A topic named "${clean}" already exists.`);

  const date = todayIso();
  writeFile(slug, { title: clean, tags, created: date, updated: date }, newTopicBody(clean), vaultDir);
  return readTopic(slug, vaultDir);
}

/** Find a topic by slug or exact (case-insensitive) title; create it if `createIfMissing`. */
function resolveTopic(titleOrSlug, { createIfMissing = false } = {}, vaultDir = DEFAULT_VAULT_DIR) {
  const bySlug = slugify(titleOrSlug);
  if (topicExists(bySlug, vaultDir)) return readTopic(bySlug, vaultDir);

  const existing = listTopics(vaultDir).find(
    (t) => t.title.toLowerCase() === titleOrSlug.trim().toLowerCase()
  );
  if (existing) return readTopic(existing.slug, vaultDir);

  if (!createIfMissing) return null;
  return createTopic({ title: titleOrSlug }, vaultDir);
}

/** Append a captured idea/example/task to a topic file's Notes or Tasks section. */
function appendEntry(slug, { type, text }, vaultDir = DEFAULT_VAULT_DIR) {
  if (!topicExists(slug, vaultDir)) throw new Error('Topic not found.');
  const { data, body } = readFile(slug, vaultDir);
  const { section, line } = formatEntry({ type, text });
  const nextBody = appendToSection(body, section, line);
  writeFile(slug, { ...data, updated: todayIso() }, nextBody, vaultDir);
  return readTopic(slug, vaultDir);
}

function toggleTask(slug, index, vaultDir = DEFAULT_VAULT_DIR) {
  if (!topicExists(slug, vaultDir)) throw new Error('Topic not found.');
  const { raw } = readFile(slug, vaultDir);
  const toggledRaw = toggleCheckbox(raw, index);
  const { data, body } = parseFrontmatter(toggledRaw);
  writeFile(slug, { ...data, updated: todayIso() }, body, vaultDir);
  return readTopic(slug, vaultDir);
}

/** Overwrite a topic's full file content (as edited by hand), re-stamping `updated`. */
function writeRaw(slug, fullContent, vaultDir = DEFAULT_VAULT_DIR) {
  if (!topicExists(slug, vaultDir)) throw new Error('Topic not found.');
  const { data: existing } = readFile(slug, vaultDir);
  const { data, body } = parseFrontmatter(fullContent);
  writeFile(slug, { ...existing, ...data, updated: todayIso() }, body, vaultDir);
  return readTopic(slug, vaultDir);
}

function deleteTopic(slug, vaultDir = DEFAULT_VAULT_DIR) {
  if (!topicExists(slug, vaultDir)) return false;
  fs.unlinkSync(filePath(slug, vaultDir));
  return true;
}

module.exports = {
  DEFAULT_VAULT_DIR,
  listTopics,
  topicExists,
  readTopic,
  createTopic,
  resolveTopic,
  appendEntry,
  toggleTask,
  writeRaw,
  deleteTopic,
};
