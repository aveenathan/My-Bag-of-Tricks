'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { sanitizeTaskFields, sortTasks, tasksForToday } = require('./taskLogic');
const { sanitizeNoteFields, searchNotes, sortNotesByRecency } = require('./noteLogic');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_PATH = path.join(DATA_DIR, 'store.json');
const DEFAULT_DATA = { tasks: [], notes: [] };

function readData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULT_DATA };
    throw err;
  }
}

function writeData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

// ---------- Tasks ----------

function listTasks() {
  return sortTasks(readData().tasks);
}

function listTasksForToday(todayIso) {
  return tasksForToday(readData().tasks, todayIso);
}

function createTask(fields) {
  const clean = sanitizeTaskFields(fields, { requireTitle: true });
  const task = {
    id: crypto.randomUUID(),
    title: clean.title,
    dueDate: clean.dueDate ?? null,
    priority: clean.priority || 'medium',
    completed: false,
    createdAt: nowIso(),
  };
  const data = readData();
  data.tasks.push(task);
  writeData(data);
  return task;
}

function updateTask(id, fields) {
  const clean = sanitizeTaskFields(fields, { requireTitle: false });
  const data = readData();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return null;
  Object.assign(task, clean);
  writeData(data);
  return task;
}

function deleteTask(id) {
  const data = readData();
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  if (data.tasks.length === before) return false;
  writeData(data);
  return true;
}

// ---------- Notes ----------

function listNotes(query) {
  return sortNotesByRecency(searchNotes(readData().notes, query));
}

function createNote(fields) {
  const clean = sanitizeNoteFields(fields, { requireTitle: true });
  const timestamp = nowIso();
  const note = {
    id: crypto.randomUUID(),
    title: clean.title,
    body: clean.body,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const data = readData();
  data.notes.push(note);
  writeData(data);
  return note;
}

function updateNote(id, fields) {
  const clean = sanitizeNoteFields(fields, { requireTitle: false });
  const data = readData();
  const note = data.notes.find((n) => n.id === id);
  if (!note) return null;
  Object.assign(note, clean, { updatedAt: nowIso() });
  writeData(data);
  return note;
}

function deleteNote(id) {
  const data = readData();
  const before = data.notes.length;
  data.notes = data.notes.filter((n) => n.id !== id);
  if (data.notes.length === before) return false;
  writeData(data);
  return true;
}

module.exports = {
  DATA_PATH,
  listTasks,
  listTasksForToday,
  createTask,
  updateTask,
  deleteTask,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
};
