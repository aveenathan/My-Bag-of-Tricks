'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { sanitizeTaskFields, sortTasks, tasksForToday } = require('./taskLogic');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_PATH = path.join(DATA_DIR, 'store.json');
const DEFAULT_DATA = { tasks: [] };

function readData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return { tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
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

// ---------- Tasks (quick, day-to-day todos — see src/vaultStore.js for
// topic-linked ideas/examples/tasks that live in markdown files instead) ----------

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

module.exports = {
  DATA_PATH,
  listTasks,
  listTasksForToday,
  createTask,
  updateTask,
  deleteTask,
};
