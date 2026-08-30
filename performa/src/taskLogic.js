'use strict';

// Pure task validation, sorting, and "what's due" logic. No I/O here — kept
// easy to unit test, with src/store.js doing the actual file reads/writes.

const PRIORITIES = ['low', 'medium', 'high'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Normalize + validate the fields of a task. `requireTitle` is true for
 * creation (a task must have a title) and false for a patch (only present
 * fields are checked; an explicitly-empty title is still rejected).
 */
function sanitizeTaskFields(fields, { requireTitle }) {
  const out = {};

  if ('title' in fields || requireTitle) {
    const title = typeof fields.title === 'string' ? fields.title.trim() : '';
    if (!title) throw new Error('Task title is required.');
    out.title = title;
  }

  if ('dueDate' in fields) {
    const { dueDate } = fields;
    if (dueDate === null || dueDate === '' || dueDate === undefined) {
      out.dueDate = null;
    } else if (isValidDate(dueDate)) {
      out.dueDate = dueDate;
    } else {
      throw new Error('dueDate must be a valid YYYY-MM-DD date, or null.');
    }
  }

  if ('priority' in fields) {
    if (!PRIORITIES.includes(fields.priority)) {
      throw new Error(`priority must be one of: ${PRIORITIES.join(', ')}.`);
    }
    out.priority = fields.priority;
  }

  if ('completed' in fields) {
    if (typeof fields.completed !== 'boolean') {
      throw new Error('completed must be a boolean.');
    }
    out.completed = fields.completed;
  }

  return out;
}

function priorityWeight(priority) {
  return PRIORITIES.indexOf(priority);
}

/**
 * Sort tasks for display: active before completed; within each group, tasks
 * with a due date come first (earliest due date first), then by priority
 * (high first), then by creation order.
 */
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    const pw = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (pw !== 0) return pw;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

function isOverdue(task, todayIso) {
  return !task.completed && Boolean(task.dueDate) && task.dueDate < todayIso;
}

/** Active tasks due today or earlier (overdue), sorted for display. */
function tasksForToday(tasks, todayIso) {
  const due = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate <= todayIso);
  return sortTasks(due);
}

module.exports = {
  PRIORITIES,
  isValidDate,
  sanitizeTaskFields,
  priorityWeight,
  sortTasks,
  isOverdue,
  tasksForToday,
};
