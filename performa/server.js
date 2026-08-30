'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const store = require('./src/store');
const vaultStore = require('./src/vaultStore');
const { suggestTopics } = require('./src/matching');
const { listCheckboxes } = require('./src/taskCheckboxes');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 200 * 1024; // plenty for a title + a long note body

const TASK_ID_RE = /^\/api\/tasks\/([^/]+)$/;
const TOPIC_SLUG_RE = /^\/api\/topics\/([^/]+)$/;
const TOPIC_TASK_RE = /^\/api\/topics\/([^/]+)\/tasks\/(\d+)$/;
const TOPIC_RAW_RE = /^\/api\/topics\/([^/]+)\/raw$/;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Quick task routes (day-to-day todos, JSON-backed) ----------

async function handleListTasks(req, res) {
  sendJson(res, 200, { tasks: store.listTasks() });
}

async function handleTasksToday(req, res) {
  sendJson(res, 200, { tasks: store.listTasksForToday(todayIso()), today: todayIso() });
}

async function handleCreateTask(req, res) {
  try {
    const body = await readJsonBody(req);
    const task = store.createTask(body);
    sendJson(res, 201, task);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleUpdateTask(req, res, id) {
  try {
    const body = await readJsonBody(req);
    const task = store.updateTask(id, body);
    if (!task) return sendJson(res, 404, { error: 'Task not found.' });
    sendJson(res, 200, task);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleDeleteTask(req, res, id) {
  const ok = store.deleteTask(id);
  if (!ok) return sendJson(res, 404, { error: 'Task not found.' });
  sendJson(res, 200, { deleted: id });
}

// ---------- Vault routes (topics: ideas/examples/tasks as markdown files) ----------

function topicSummary(topic) {
  const checks = listCheckboxes(topic.content);
  return {
    slug: topic.slug,
    title: topic.title,
    tags: topic.tags,
    created: topic.created,
    updated: topic.updated,
    openTasks: checks.filter((c) => !c.completed).length,
    totalTasks: checks.length,
  };
}

async function handleListTopics(req, res) {
  sendJson(res, 200, { topics: vaultStore.listTopics().map(topicSummary) });
}

async function handleSuggestTopics(req, res, searchParams) {
  const text = searchParams.get('text') || '';
  sendJson(res, 200, { suggestions: suggestTopics(text, vaultStore.listTopics()) });
}

async function handleCreateTopic(req, res) {
  try {
    const body = await readJsonBody(req);
    const topic = vaultStore.createTopic(body);
    sendJson(res, 201, topic);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleGetTopic(req, res, slug) {
  const topic = vaultStore.readTopic(slug);
  if (!topic) return sendJson(res, 404, { error: 'Topic not found.' });
  sendJson(res, 200, topic);
}

async function handleDeleteTopic(req, res, slug) {
  const ok = vaultStore.deleteTopic(slug);
  if (!ok) return sendJson(res, 404, { error: 'Topic not found.' });
  sendJson(res, 200, { deleted: slug });
}

async function handleToggleTask(req, res, slug, index) {
  try {
    const topic = vaultStore.toggleTask(slug, Number(index));
    sendJson(res, 200, topic);
  } catch (err) {
    sendJson(res, err.message === 'Topic not found.' ? 404 : 400, { error: err.message });
  }
}

async function handleWriteRaw(req, res, slug) {
  try {
    const body = await readJsonBody(req);
    const topic = vaultStore.writeRaw(slug, body.content || '');
    sendJson(res, 200, topic);
  } catch (err) {
    sendJson(res, err.message === 'Topic not found.' ? 404 : 400, { error: err.message });
  }
}

// Capture one thought (idea/example/task) into one or more topic files at
// once — an existing topic by slug, and/or brand-new topics created on the fly.
async function handleCapture(req, res) {
  try {
    const body = await readJsonBody(req);
    const { text, type, topicSlugs = [], newTopicTitles = [] } = body;

    const slugs = new Set(topicSlugs);
    for (const title of newTopicTitles) {
      const topic = vaultStore.resolveTopic(title, { createIfMissing: true });
      slugs.add(topic.slug);
    }
    if (slugs.size === 0) {
      return sendJson(res, 400, { error: 'At least one topic (existing or new) is required.' });
    }

    const results = [...slugs].map((slug) => vaultStore.appendEntry(slug, { type, text }));
    sendJson(res, 201, { topics: results });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

// ---------- Static files ----------

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Server error');
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname, searchParams } = url;

  if (pathname === '/api/tasks/today' && req.method === 'GET') {
    return handleTasksToday(req, res);
  }
  if (pathname === '/api/tasks' && req.method === 'GET') {
    return handleListTasks(req, res);
  }
  if (pathname === '/api/tasks' && req.method === 'POST') {
    return handleCreateTask(req, res);
  }
  const taskMatch = TASK_ID_RE.exec(pathname);
  if (taskMatch && req.method === 'PATCH') {
    return handleUpdateTask(req, res, decodeURIComponent(taskMatch[1]));
  }
  if (taskMatch && req.method === 'DELETE') {
    return handleDeleteTask(req, res, decodeURIComponent(taskMatch[1]));
  }

  if (pathname === '/api/topics/suggest' && req.method === 'GET') {
    return handleSuggestTopics(req, res, searchParams);
  }
  if (pathname === '/api/topics' && req.method === 'GET') {
    return handleListTopics(req, res);
  }
  if (pathname === '/api/topics' && req.method === 'POST') {
    return handleCreateTopic(req, res);
  }
  if (pathname === '/api/captures' && req.method === 'POST') {
    return handleCapture(req, res);
  }
  const topicTaskMatch = TOPIC_TASK_RE.exec(pathname);
  if (topicTaskMatch && req.method === 'PATCH') {
    return handleToggleTask(req, res, decodeURIComponent(topicTaskMatch[1]), topicTaskMatch[2]);
  }
  const topicRawMatch = TOPIC_RAW_RE.exec(pathname);
  if (topicRawMatch && req.method === 'PUT') {
    return handleWriteRaw(req, res, decodeURIComponent(topicRawMatch[1]));
  }
  const topicMatch = TOPIC_SLUG_RE.exec(pathname);
  if (topicMatch && req.method === 'GET') {
    return handleGetTopic(req, res, decodeURIComponent(topicMatch[1]));
  }
  if (topicMatch && req.method === 'DELETE') {
    return handleDeleteTopic(req, res, decodeURIComponent(topicMatch[1]));
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Performa running at http://localhost:${PORT}`);
});

module.exports = server;
