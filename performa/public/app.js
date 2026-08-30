'use strict';

const state = {
  tasks: [],
  taskFilter: 'all',

  topics: [], // [{slug, title, tags, updated, openTasks, totalTasks}]
  currentTopicSlug: null,

  capture: {
    suggestions: [], // [{slug, title, score}]
    selectedSlugs: new Set(),
    newTitles: [],
  },
};

const els = {
  statusBanner: document.getElementById('status-banner'),

  quickAddForm: document.getElementById('quick-add-form'),
  quickTitle: document.getElementById('quick-title'),
  quickDue: document.getElementById('quick-due'),
  quickPriority: document.getElementById('quick-priority'),
  todayList: document.getElementById('today-list'),

  tasksList: document.getElementById('tasks-list'),

  captureText: document.getElementById('capture-text'),
  suggestHint: document.getElementById('suggest-hint'),
  suggestedTopics: document.getElementById('suggested-topics'),
  topicPickerInput: document.getElementById('topic-picker-input'),
  allTopicsDatalist: document.getElementById('all-topics'),
  addTopicChip: document.getElementById('add-topic-chip'),
  selectedChips: document.getElementById('selected-chips'),
  captureSubmit: document.getElementById('capture-submit'),

  topicsListPanel: document.getElementById('topics-list-panel'),
  topicsList: document.getElementById('topics-list'),
  capturePanel: document.getElementById('capture-panel'),

  topicDetailPanel: document.getElementById('topic-detail-panel'),
  topicDetailTitle: document.getElementById('topic-detail-title'),
  topicTags: document.getElementById('topic-tags'),
  topicRendered: document.getElementById('topic-rendered'),
  backToTopics: document.getElementById('back-to-topics'),
  toggleRaw: document.getElementById('toggle-raw'),
  deleteTopic: document.getElementById('delete-topic'),
  topicRawEditor: document.getElementById('topic-raw-editor'),
  rawTextarea: document.getElementById('raw-textarea'),
  rawCancel: document.getElementById('raw-cancel'),
  rawSave: document.getElementById('raw-save'),
};

function showStatus(message, kind) {
  els.statusBanner.textContent = message;
  els.statusBanner.hidden = !message;
  els.statusBanner.className = kind ? `status ${kind}` : 'status';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: options && options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

// ---------- Tabs ----------

document.querySelectorAll('.tab-button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.hidden = panel.id !== `tab-${target}`;
    });
  });
});

// ---------- Tasks (Today + Tasks tabs) ----------

function priorityBadge(priority) {
  return `<span class="badge priority-${priority}">${priority}</span>`;
}

function taskRow(task, { todayIso }) {
  const overdue = !task.completed && task.dueDate && task.dueDate < todayIso;
  const row = document.createElement('div');
  row.className = 'task-row' + (task.completed ? ' completed' : '');
  row.innerHTML = `
    <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} />
    <span class="task-title">${escapeHtml(task.title)}</span>
    ${task.dueDate ? `<span class="badge due-badge ${overdue ? 'overdue' : ''}">${task.dueDate}</span>` : ''}
    ${priorityBadge(task.priority)}
    <button class="icon-button edit-task" title="Edit" type="button">✎</button>
    <button class="icon-button delete-task" title="Delete" type="button">✕</button>
  `;

  row.querySelector('.task-check').addEventListener('change', async (e) => {
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed: e.target.checked }) });
      await refreshTasks();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  });

  row.querySelector('.delete-task').addEventListener('click', async () => {
    try {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      await refreshTasks();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  });

  row.querySelector('.edit-task').addEventListener('click', () => startEditingTask(row, task));

  return row;
}

function startEditingTask(row, task) {
  row.innerHTML = `
    <input type="text" class="edit-title" value="${escapeHtml(task.title)}" maxlength="200" />
    <input type="date" class="edit-due" value="${task.dueDate || ''}" />
    <select class="edit-priority">
      <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
      <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
      <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
    </select>
    <button class="save-task" type="button">Save</button>
    <button class="secondary cancel-task" type="button">Cancel</button>
  `;

  row.querySelector('.cancel-task').addEventListener('click', () => renderAll());

  row.querySelector('.save-task').addEventListener('click', async () => {
    const title = row.querySelector('.edit-title').value.trim();
    const dueDate = row.querySelector('.edit-due').value || null;
    const priority = row.querySelector('.edit-priority').value;
    if (!title) return showStatus('Task title is required.', 'error');
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ title, dueDate, priority }) });
      await refreshTasks();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  });
}

function renderTaskList(container, tasks, todayIso, emptyMessage) {
  container.innerHTML = '';
  if (tasks.length === 0) {
    container.innerHTML = `<p class="hint empty">${emptyMessage}</p>`;
    return;
  }
  for (const task of tasks) {
    container.appendChild(taskRow(task, { todayIso }));
  }
}

function applyTaskFilter(tasks) {
  if (state.taskFilter === 'active') return tasks.filter((t) => !t.completed);
  if (state.taskFilter === 'completed') return tasks.filter((t) => t.completed);
  return tasks;
}

function renderAll() {
  const todayIso = new Date().toISOString().slice(0, 10);
  renderTaskList(els.tasksList, applyTaskFilter(state.tasks), todayIso, 'No tasks here yet.');
}

async function refreshTasks() {
  try {
    const [{ tasks }, { tasks: dueTasks, today }] = await Promise.all([
      api('/api/tasks'),
      api('/api/tasks/today'),
    ]);
    state.tasks = tasks;
    renderTaskList(els.todayList, dueTasks, today, 'Nothing due today. 🎉');
    renderAll();
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

els.quickAddForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = els.quickTitle.value.trim();
  if (!title) return;
  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        dueDate: els.quickDue.value || null,
        priority: els.quickPriority.value,
      }),
    });
    els.quickTitle.value = '';
    els.quickDue.value = '';
    els.quickPriority.value = 'medium';
    await refreshTasks();
  } catch (err) {
    showStatus(err.message, 'error');
  }
});

document.querySelectorAll('.filter-button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.taskFilter = btn.dataset.filter;
    renderAll();
  });
});

// ---------- Topics: vault list + detail ----------

function topicCard(topic) {
  const card = document.createElement('div');
  card.className = 'topic-card';
  card.innerHTML = `
    <h3>${escapeHtml(topic.title)}</h3>
    <div class="chip-row">${topic.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>
    <p class="hint">
      ${topic.totalTasks ? `${topic.openTasks}/${topic.totalTasks} tasks open · ` : ''}updated ${topic.updated}
    </p>
  `;
  card.addEventListener('click', () => openTopicDetail(topic.slug));
  return card;
}

async function refreshTopicsList() {
  try {
    const { topics } = await api('/api/topics');
    state.topics = topics;
    renderTopicsGrid();
    renderTopicsDatalist();
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

function renderTopicsGrid() {
  els.topicsList.innerHTML = '';
  if (state.topics.length === 0) {
    els.topicsList.innerHTML = '<p class="hint empty">No topics yet — capture a thought above to start one.</p>';
    return;
  }
  for (const topic of state.topics) els.topicsList.appendChild(topicCard(topic));
}

function renderTopicsDatalist() {
  els.allTopicsDatalist.innerHTML = state.topics
    .map((t) => `<option value="${escapeHtml(t.title)}"></option>`)
    .join('');
}

function findTopicByTitle(title) {
  const needle = title.trim().toLowerCase();
  return state.topics.find((t) => t.title.toLowerCase() === needle);
}

// ---------- Capture form: suggestions + topic selection ----------

function renderSuggestions() {
  const { suggestions, selectedSlugs } = state.capture;
  els.suggestHint.hidden = suggestions.length > 0;
  els.suggestedTopics.innerHTML = suggestions
    .map(
      (s) => `
      <label class="topic-check">
        <input type="checkbox" data-slug="${escapeHtml(s.slug)}" ${selectedSlugs.has(s.slug) ? 'checked' : ''} />
        ${escapeHtml(s.title)}
      </label>`
    )
    .join('');

  els.suggestedTopics.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.capture.selectedSlugs.add(cb.dataset.slug);
      else state.capture.selectedSlugs.delete(cb.dataset.slug);
      renderChips();
    });
  });
}

function renderChips() {
  const chips = [];
  for (const slug of state.capture.selectedSlugs) {
    const topic = state.topics.find((t) => t.slug === slug);
    chips.push({ kind: 'existing', key: slug, label: topic ? topic.title : slug });
  }
  for (const title of state.capture.newTitles) {
    chips.push({ kind: 'new', key: title, label: `+ New: ${title}` });
  }

  els.selectedChips.innerHTML = chips
    .map(
      (c) => `<span class="chip removable ${c.kind}">${escapeHtml(c.label)} <button type="button" data-kind="${c.kind}" data-key="${escapeHtml(c.key)}">×</button></span>`
    )
    .join('');

  els.selectedChips.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.kind === 'existing') {
        state.capture.selectedSlugs.delete(btn.dataset.key);
        renderSuggestions();
      } else {
        state.capture.newTitles = state.capture.newTitles.filter((t) => t !== btn.dataset.key);
      }
      renderChips();
    });
  });
}

let suggestDebounce;
els.captureText.addEventListener('input', () => {
  clearTimeout(suggestDebounce);
  const text = els.captureText.value.trim();
  if (!text) {
    state.capture.suggestions = [];
    renderSuggestions();
    return;
  }
  suggestDebounce = setTimeout(async () => {
    try {
      const { suggestions } = await api(`/api/topics/suggest?text=${encodeURIComponent(text)}`);
      state.capture.suggestions = suggestions;
      renderSuggestions();
    } catch (err) {
      // Suggestions are a nicety — a failed lookup shouldn't block capturing.
    }
  }, 250);
});

els.addTopicChip.addEventListener('click', () => {
  const value = els.topicPickerInput.value.trim();
  if (!value) return;
  const existing = findTopicByTitle(value);
  if (existing) {
    state.capture.selectedSlugs.add(existing.slug);
    renderSuggestions();
  } else if (!state.capture.newTitles.some((t) => t.toLowerCase() === value.toLowerCase())) {
    state.capture.newTitles.push(value);
  }
  els.topicPickerInput.value = '';
  renderChips();
});

els.topicPickerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    els.addTopicChip.click();
  }
});

function resetCaptureForm() {
  els.captureText.value = '';
  els.topicPickerInput.value = '';
  document.querySelector('input[name="capture-type"][value="idea"]').checked = true;
  state.capture = { suggestions: [], selectedSlugs: new Set(), newTitles: [] };
  renderSuggestions();
  renderChips();
}

els.captureSubmit.addEventListener('click', async () => {
  const text = els.captureText.value.trim();
  const type = document.querySelector('input[name="capture-type"]:checked').value;
  const topicSlugs = [...state.capture.selectedSlugs];
  const newTopicTitles = [...state.capture.newTitles];

  if (!text) return showStatus('Write something to capture first.', 'error');
  if (topicSlugs.length === 0 && newTopicTitles.length === 0) {
    return showStatus('Pick or create at least one topic to file this under.', 'error');
  }

  try {
    await api('/api/captures', { method: 'POST', body: JSON.stringify({ text, type, topicSlugs, newTopicTitles }) });
    const filedCount = topicSlugs.length + newTopicTitles.length;
    resetCaptureForm();
    await refreshTopicsList();
    if (state.currentTopicSlug) await openTopicDetail(state.currentTopicSlug);
    showStatus(`Filed under ${filedCount} topic${filedCount === 1 ? '' : 's'}.`, 'success');
  } catch (err) {
    showStatus(err.message, 'error');
  }
});

// ---------- Topic detail: rendered markdown + raw editor ----------

function renderMarkdown(body) {
  const lines = body.split(/\r?\n/);
  let html = '';
  let inList = false;
  let checkboxIndex = 0;

  const inline = (text) => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  const openList = () => {
    if (!inList) {
      html += '<ul class="md-list">';
      inList = true;
    }
  };

  for (const line of lines) {
    const h1 = /^#\s+(.+)$/.exec(line);
    const h2 = /^##\s+(.+)$/.exec(line);
    const checkbox = /^-\s*\[( |x|X)\]\s*(.*)$/.exec(line);
    const bullet = /^-\s+(.*)$/.exec(line);

    if (h1) {
      closeList();
      html += `<h1>${inline(h1[1])}</h1>`;
    } else if (h2) {
      closeList();
      html += `<h2>${inline(h2[1])}</h2>`;
    } else if (checkbox) {
      openList();
      const idx = checkboxIndex++;
      const checked = checkbox[1].toLowerCase() === 'x';
      html += `<li class="md-task"><label><input type="checkbox" data-task-index="${idx}" ${checked ? 'checked' : ''}/> <span class="${checked ? 'done' : ''}">${inline(checkbox[2])}</span></label></li>`;
    } else if (bullet) {
      openList();
      html += `<li>${inline(bullet[1])}</li>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html || '<p class="hint">Nothing here yet.</p>';
}

async function openTopicDetail(slug) {
  try {
    const topic = await api(`/api/topics/${encodeURIComponent(slug)}`);
    state.currentTopicSlug = slug;
    els.topicDetailTitle.textContent = topic.title;
    els.topicTags.innerHTML = topic.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('');
    els.topicRendered.innerHTML = renderMarkdown(topic.body);
    els.rawTextarea.value = topic.raw;
    els.topicRawEditor.hidden = true;
    els.topicRendered.hidden = false;
    els.toggleRaw.textContent = 'View raw';

    els.topicsListPanel.hidden = true;
    els.capturePanel.hidden = true;
    els.topicDetailPanel.hidden = false;
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

function closeTopicDetail() {
  state.currentTopicSlug = null;
  els.topicDetailPanel.hidden = true;
  els.topicsListPanel.hidden = false;
  els.capturePanel.hidden = false;
}

els.backToTopics.addEventListener('click', closeTopicDetail);

els.topicRendered.addEventListener('change', async (e) => {
  const input = e.target.closest('input[data-task-index]');
  if (!input || !state.currentTopicSlug) return;
  try {
    await api(`/api/topics/${encodeURIComponent(state.currentTopicSlug)}/tasks/${input.dataset.taskIndex}`, {
      method: 'PATCH',
    });
    await openTopicDetail(state.currentTopicSlug);
    await refreshTopicsList();
  } catch (err) {
    showStatus(err.message, 'error');
  }
});

els.toggleRaw.addEventListener('click', () => {
  const showingRaw = !els.topicRawEditor.hidden;
  els.topicRawEditor.hidden = showingRaw;
  els.topicRendered.hidden = !showingRaw;
  els.toggleRaw.textContent = showingRaw ? 'View raw' : 'View rendered';
});

els.rawCancel.addEventListener('click', () => {
  els.topicRawEditor.hidden = true;
  els.topicRendered.hidden = false;
  els.toggleRaw.textContent = 'View raw';
});

els.rawSave.addEventListener('click', async () => {
  if (!state.currentTopicSlug) return;
  try {
    await api(`/api/topics/${encodeURIComponent(state.currentTopicSlug)}/raw`, {
      method: 'PUT',
      body: JSON.stringify({ content: els.rawTextarea.value }),
    });
    await openTopicDetail(state.currentTopicSlug);
    await refreshTopicsList();
    showStatus('Saved.', 'success');
  } catch (err) {
    showStatus(err.message, 'error');
  }
});

els.deleteTopic.addEventListener('click', async () => {
  if (!state.currentTopicSlug) return;
  if (!confirm('Delete this topic file? This cannot be undone.')) return;
  try {
    await api(`/api/topics/${encodeURIComponent(state.currentTopicSlug)}`, { method: 'DELETE' });
    closeTopicDetail();
    await refreshTopicsList();
  } catch (err) {
    showStatus(err.message, 'error');
  }
});

// ---------- Init ----------

refreshTasks();
refreshTopicsList();
renderSuggestions();
renderChips();
