'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const store = require('./src/store');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 200 * 1024; // plenty for a title + a long note body

const TASK_ID_RE = /^\/api\/tasks\/([^/]+)$/;
const NOTE_ID_RE = /^\/api\/notes\/([^/]+)$/;

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

// ---------- Task routes ----------

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

// ---------- Note routes ----------

async function handleListNotes(req, res, searchParams) {
  sendJson(res, 200, { notes: store.listNotes(searchParams.get('q') || '') });
}

async function handleCreateNote(req, res) {
  try {
    const body = await readJsonBody(req);
    const note = store.createNote(body);
    sendJson(res, 201, note);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleUpdateNote(req, res, id) {
  try {
    const body = await readJsonBody(req);
    const note = store.updateNote(id, body);
    if (!note) return sendJson(res, 404, { error: 'Note not found.' });
    sendJson(res, 200, note);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleDeleteNote(req, res, id) {
  const ok = store.deleteNote(id);
  if (!ok) return sendJson(res, 404, { error: 'Note not found.' });
  sendJson(res, 200, { deleted: id });
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

  if (pathname === '/api/notes' && req.method === 'GET') {
    return handleListNotes(req, res, searchParams);
  }
  if (pathname === '/api/notes' && req.method === 'POST') {
    return handleCreateNote(req, res);
  }
  const noteMatch = NOTE_ID_RE.exec(pathname);
  if (noteMatch && req.method === 'PATCH') {
    return handleUpdateNote(req, res, decodeURIComponent(noteMatch[1]));
  }
  if (noteMatch && req.method === 'DELETE') {
    return handleDeleteNote(req, res, decodeURIComponent(noteMatch[1]));
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Performa running at http://localhost:${PORT}`);
});

module.exports = server;
