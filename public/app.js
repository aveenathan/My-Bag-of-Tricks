'use strict';

/* --- YouTube IFrame player --- */
let ytPlayer = null;
let ytReady = false;

// Called automatically by the YouTube IFrame API script once it loads.
window.onYouTubeIframeAPIReady = function () {
  ytReady = true;
};

function playVideo(video) {
  const section = document.getElementById('player-section');
  section.hidden = false;
  document.getElementById('player-title').textContent = video.title;
  document.getElementById('player-channel').textContent = video.channelTitle;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const start = () => {
    if (ytPlayer) {
      ytPlayer.loadVideoById(video.id);
      return;
    }
    ytPlayer = new YT.Player('player', {
      videoId: video.id,
      playerVars: { rel: 0, modestbranding: 1 },
    });
  };

  if (ytReady) start();
  else {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      ytReady = true;
      if (prev) prev();
      start();
    };
  }
}

/* --- Search & results --- */

function setStatus(message, show = true) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.hidden = !show;
}

function videoCard(entry) {
  const li = document.createElement('div');
  li.className = 'video-card';
  li.innerHTML = `
    <img src="${entry.video.thumbnail}" alt="" loading="lazy" />
    <div class="card-body">
      <h3>${escapeHtml(entry.video.title)}</h3>
      <p>${escapeHtml(entry.video.channelTitle)}</p>
    </div>
  `;
  li.addEventListener('click', () => playVideo(entry.video));
  return li;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let lastResults = null;

async function runSearch(query) {
  setStatus(`Searching for "${query}"…`);
  document.getElementById('results').innerHTML = '';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || 'Something went wrong.');
      return;
    }

    lastResults = data;
    renderResults(data);
    renderReviewQueue(data);

    const hiddenCount = data.counts.borderline + data.counts.blocked;
    const demoPrefix = data.demoMode
      ? '🧪 Demo mode (no YOUTUBE_API_KEY set, showing sample data) — '
      : '';
    setStatus(
      demoPrefix +
        `Showing ${data.counts.allowed} kid-safe video${data.counts.allowed === 1 ? '' : 's'}` +
        (hiddenCount ? ` — ${hiddenCount} filtered out as likely AI slop (see Parent Zone).` : '.')
    );
  } catch (err) {
    setStatus('Could not reach the server. Is it running?');
  }
}

function renderResults(data) {
  const results = document.getElementById('results');
  results.innerHTML = '';

  if (data.allowed.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No kid-safe videos found for that search. Try another term!';
    results.appendChild(empty);
    return;
  }

  for (const entry of data.allowed) {
    results.appendChild(videoCard(entry));
  }
}

function renderReviewQueue(data) {
  const container = document.getElementById('review-list');
  container.innerHTML = '';
  const flagged = [...data.blocked, ...data.borderline];

  if (flagged.length === 0) {
    container.innerHTML = '<p class="hint">Nothing was filtered out from the last search.</p>';
    return;
  }

  for (const entry of flagged) {
    const card = document.createElement('div');
    card.className = 'review-card';
    const badge = entry.verdict === 'blocked' ? 'blocked' : 'borderline';
    card.innerHTML = `
      <img src="${entry.video.thumbnail}" alt="" loading="lazy" />
      <div class="review-body">
        <span class="badge ${badge}">${badge === 'blocked' ? 'Filtered out' : 'Borderline'} · score ${entry.score}</span>
        <h5>${escapeHtml(entry.video.title)}</h5>
        <p class="channel">${escapeHtml(entry.video.channelTitle)}</p>
        <ul>${entry.reasons.map((r) => `<li>${escapeHtml(r.detail)}</li>`).join('')}</ul>
        <div class="review-actions">
          <button class="allow" data-channel="${entry.video.channelId}" data-action="allow">Allow channel</button>
          <button class="block" data-channel="${entry.video.channelId}" data-action="block">Block channel</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }

  container.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch('/api/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: btn.dataset.channel, to: btn.dataset.action === 'allow' ? 'allow' : 'block' }),
      });
      await loadConfig();
      if (lastResults) runSearch(lastResults.query);
    });
  });
}

document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = document.getElementById('search-input').value.trim();
  if (q) runSearch(q);
});

/* --- Parent gate --- */

let gateAnswer = 0;

function openGate() {
  const a = Math.ceil(Math.random() * 8) + 2;
  const b = Math.ceil(Math.random() * 8) + 2;
  gateAnswer = a + b;
  document.getElementById('gate-question').textContent = `Solve to continue: ${a} + ${b} = ?`;
  document.getElementById('gate-answer').value = '';
  document.getElementById('gate-error').hidden = true;
  document.getElementById('parent-gate').hidden = false;
  document.getElementById('gate-answer').focus();
}

document.getElementById('open-parent-gate').addEventListener('click', openGate);
document.getElementById('gate-cancel').addEventListener('click', () => {
  document.getElementById('parent-gate').hidden = true;
});
document.getElementById('gate-submit').addEventListener('click', () => {
  const val = Number(document.getElementById('gate-answer').value);
  if (val === gateAnswer) {
    document.getElementById('parent-gate').hidden = true;
    openParentPanel();
  } else {
    document.getElementById('gate-error').hidden = false;
  }
});

/* --- Parent panel --- */

let currentConfig = null;

async function loadConfig() {
  const res = await fetch('/api/config');
  currentConfig = await res.json();
  renderConfig();
}

function renderConfig() {
  if (!currentConfig) return;
  document.getElementById('threshold-slider').value = currentConfig.threshold;
  document.getElementById('threshold-value').textContent = currentConfig.threshold;

  renderChipList('allowlist', currentConfig.allowlistChannelIds, 'block');
  renderChipList('blocklist', currentConfig.blocklistChannelIds, 'allow');
}

function renderChipList(elementId, channelIds, removeTo) {
  const ul = document.getElementById(elementId);
  ul.innerHTML = '';
  if (channelIds.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'None yet — flag a video below to add one.';
    ul.appendChild(li);
    return;
  }
  for (const id of channelIds) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(id)}</span> <button title="Remove">×</button>`;
    li.querySelector('button').addEventListener('click', async () => {
      await fetch('/api/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: id, to: 'neutral' }),
      });
      await loadConfig();
    });
    ul.appendChild(li);
  }
}

document.getElementById('threshold-slider').addEventListener('change', async (e) => {
  await fetch('/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threshold: Number(e.target.value) }),
  });
  await loadConfig();
  if (lastResults) runSearch(lastResults.query);
});

async function openParentPanel() {
  await loadConfig();
  if (lastResults) renderReviewQueue(lastResults);
  document.getElementById('parent-panel').hidden = false;
}

document.getElementById('close-parent-panel').addEventListener('click', () => {
  document.getElementById('parent-panel').hidden = true;
});

/* Initial load */
loadConfig();
