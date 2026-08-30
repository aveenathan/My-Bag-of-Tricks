'use strict';

const state = {
  tasks: [],
  notes: [],
  taskFilter: 'all',
  editingNoteId: null, // null while creating a new note
};

const els = {
  statusBanner: document.getElementById('status-banner'),

  quickAddForm: document.getElementById('quick-add-form'),
  quickTitle: document.getElementById('quick-title'),
  quickDue: document.getElementById('quick-due'),
  quickPriority: document.getElementById('quick-priority'),
  todayList: document.getElementById('today-list'),

  tasksList: document.getElementById('tasks-list'),

  notesSearch: document.getElementById('notes-search'),
  newNoteBtn: document.getElementById('new-note'),
  notesList: document.getElementById('notes-list'),

  noteModal: document.getElementById('note-modal'),
  noteModalTitle: document.getElementById('note-modal-title'),
  noteTitleInput: document.getElementById('note-title-input'),
  noteBodyInput: document.getElementById('note-body-input'),
  noteCancel: document.getElementById('note-cancel'),
  noteSave: document.getElementById('note-save'),
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

// ---------- Tasks ----------

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

// ---------- Notes ----------

function noteCard(note) {
  const card = document.createElement('div');
  card.className = 'note-card';
  const preview = note.body.length > 140 ? note.body.slice(0, 140) + '…' : note.body;
  card.innerHTML = `
    <h3>${escapeHtml(note.title)}</h3>
    <p class="note-preview">${escapeHtml(preview)}</p>
    <div class="note-footer">
      <span class="hint">${note.updatedAt.slice(0, 10)}</span>
      <div class="note-actions">
        <button class="icon-button edit-note" type="button" title="Edit">✎</button>
        <button class="icon-button delete-note" type="button" title="Delete">✕</button>
      </div>
    </div>
  `;
  card.querySelector('.edit-note').addEventListener('click', () => openNoteModal(note));
  card.querySelector('.delete-note').addEventListener('click', async () => {
    try {
      await api(`/api/notes/${note.id}`, { method: 'DELETE' });
      await refreshNotes();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  });
  return card;
}

async function refreshNotes() {
  try {
    const { notes } = await api(`/api/notes?q=${encodeURIComponent(els.notesSearch.value.trim())}`);
    state.notes = notes;
    els.notesList.innerHTML = '';
    if (notes.length === 0) {
      els.notesList.innerHTML = '<p class="hint empty">No notes yet — add one!</p>';
      return;
    }
    for (const note of notes) els.notesList.appendChild(noteCard(note));
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

let searchDebounce;
els.notesSearch.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(refreshNotes, 200);
});

function openNoteModal(note) {
  state.editingNoteId = note ? note.id : null;
  els.noteModalTitle.textContent = note ? 'Edit note' : 'New note';
  els.noteTitleInput.value = note ? note.title : '';
  els.noteBodyInput.value = note ? note.body : '';
  els.noteModal.hidden = false;
  els.noteTitleInput.focus();
}

els.newNoteBtn.addEventListener('click', () => openNoteModal(null));
els.noteCancel.addEventListener('click', () => {
  els.noteModal.hidden = true;
});

els.noteSave.addEventListener('click', async () => {
  const title = els.noteTitleInput.value.trim();
  const body = els.noteBodyInput.value;
  if (!title) return showStatus('Note title is required.', 'error');

  try {
    if (state.editingNoteId) {
      await api(`/api/notes/${state.editingNoteId}`, { method: 'PATCH', body: JSON.stringify({ title, body }) });
    } else {
      await api('/api/notes', { method: 'POST', body: JSON.stringify({ title, body }) });
    }
    els.noteModal.hidden = true;
    await refreshNotes();
  } catch (err) {
    showStatus(err.message, 'error');
  }
});

// ---------- Init ----------

refreshTasks();
refreshNotes();
