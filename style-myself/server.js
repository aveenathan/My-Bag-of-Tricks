'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { generateTryOn } = require('./src/openaiClient');

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Two selfie-sized base64 images plus a bit of JSON overhead — 30MB covers
// comfortably-sized photos without leaving the endpoint wide open.
const MAX_BODY_BYTES = 30 * 1024 * 1024;

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

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleStatus(req, res) {
  sendJson(res, 200, { aiEnabled: Boolean(OPENAI_API_KEY) });
}

async function handleTryOn(req, res) {
  if (!OPENAI_API_KEY) {
    return sendJson(res, 501, {
      error: 'AI Blend needs an OPENAI_API_KEY on the server — see .env.example. Quick Try-On works without one.',
    });
  }

  let body;
  try {
    body = await readBody(req, MAX_BODY_BYTES);
  } catch (err) {
    return sendJson(res, 413, { error: err.message });
  }

  let selfie, dress, styleNote;
  try {
    const parsed = body ? JSON.parse(body) : {};
    selfie = parsed.selfie;
    dress = parsed.dress;
    styleNote = parsed.styleNote;
  } catch (err) {
    return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }

  if (!selfie || !dress) {
    return sendJson(res, 400, { error: 'Both "selfie" and "dress" image data URLs are required.' });
  }

  try {
    const image = await generateTryOn({
      selfieDataUrl: selfie,
      dressDataUrl: dress,
      styleNote,
      apiKey: OPENAI_API_KEY,
    });
    sendJson(res, 200, { image });
  } catch (err) {
    const isInputError = /Unsupported|too large|empty|data URL|required/.test(err.message);
    sendJson(res, isInputError ? 400 : 502, { error: err.message });
  }
}

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
  const { pathname } = url;

  if (pathname === '/api/status' && req.method === 'GET') {
    return handleStatus(req, res);
  }
  if (pathname === '/api/tryon' && req.method === 'POST') {
    return handleTryOn(req, res);
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  if (!OPENAI_API_KEY) {
    console.warn(
      'OPENAI_API_KEY is not set — AI Blend is disabled, but Quick Try-On (drag-and-fit, fully client-side) still works. See .env.example.'
    );
  }
  console.log(`Style Myself running at http://localhost:${PORT}`);
});

module.exports = server;
