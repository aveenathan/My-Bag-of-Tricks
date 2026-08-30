'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { searchVideos } = require('./src/youtubeClient');
const { filterVideos } = require('./src/aiSlopFilter');
const { readLists, writeLists, moveChannel } = require('./src/listsStore');
const { SAMPLE_VIDEOS } = require('./src/sampleVideos');

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Tiny in-memory cache so repeated searches (or a kid re-clicking "search")
// don't burn through the YouTube Data API's daily quota (search.list costs
// 100 units against a 10,000/day default budget — ~100 searches/day).
const searchCache = new Map(); // query -> { at, data }
const CACHE_TTL_MS = 5 * 60 * 1000;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleSearch(req, res, query) {
  const q = (query.get('q') || '').trim();
  if (!q) {
    return sendJson(res, 400, { error: 'Query parameter "q" is required.' });
  }

  try {
    let videos;
    let demoMode = false;

    if (!YOUTUBE_API_KEY) {
      // No API key configured — fall back to canned sample data so the app
      // (search → filter → play) can still be tried out end-to-end.
      demoMode = true;
      const needle = q.toLowerCase();
      const matched = SAMPLE_VIDEOS.filter(
        (v) =>
          v.title.toLowerCase().includes(needle) ||
          v.description.toLowerCase().includes(needle) ||
          v.channelTitle.toLowerCase().includes(needle)
      );
      videos = (matched.length > 0 ? matched : SAMPLE_VIDEOS).map((v) => ({
        ...v,
        thumbnail: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
      }));
    } else {
      const cached = searchCache.get(q);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        videos = cached.data;
      } else {
        videos = await searchVideos(q, { apiKey: YOUTUBE_API_KEY, maxResults: 25 });
        searchCache.set(q, { at: Date.now(), data: videos });
      }
    }

    const lists = readLists();
    const { allowed, borderline, blocked } = filterVideos(videos, lists);

    sendJson(res, 200, {
      query: q,
      demoMode,
      threshold: lists.threshold,
      counts: { allowed: allowed.length, borderline: borderline.length, blocked: blocked.length },
      allowed,
      borderline,
      blocked,
    });
  } catch (err) {
    sendJson(res, 502, { error: err.message });
  }
}

async function handleConfigGet(req, res) {
  sendJson(res, 200, readLists());
}

async function handleConfigPatch(req, res) {
  try {
    const body = await readBody(req);
    const patch = body ? JSON.parse(body) : {};
    const next = writeLists(patch);
    sendJson(res, 200, next);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleChannelMove(req, res) {
  try {
    const body = await readBody(req);
    const { channelId, to } = body ? JSON.parse(body) : {};
    if (!channelId || !['allow', 'block', 'neutral'].includes(to)) {
      return sendJson(res, 400, { error: 'Expected { channelId, to: "allow"|"block"|"neutral" }.' });
    }
    const next = moveChannel(channelId, { to });
    sendJson(res, 200, next);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
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
  const { pathname, searchParams } = url;

  if (pathname === '/api/search' && req.method === 'GET') {
    return handleSearch(req, res, searchParams);
  }
  if (pathname === '/api/config' && req.method === 'GET') {
    return handleConfigGet(req, res);
  }
  if (pathname === '/api/config' && req.method === 'PATCH') {
    return handleConfigPatch(req, res);
  }
  if (pathname === '/api/channel' && req.method === 'POST') {
    return handleChannelMove(req, res);
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  if (!YOUTUBE_API_KEY) {
    console.warn(
      'YOUTUBE_API_KEY is not set — running in DEMO MODE with sample data. See .env.example to search real YouTube.'
    );
  }
  console.log(`AI-slop-filtered YouTube player running at http://localhost:${PORT}`);
});

module.exports = server;
