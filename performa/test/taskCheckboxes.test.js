'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { listCheckboxes, toggleCheckbox } = require('../src/taskCheckboxes');

const SAMPLE = [
  '# Topic',
  '',
  '## Notes',
  '- not a checkbox',
  '',
  '## Tasks',
  '- [ ] first task',
  '- [x] second task, already done',
  '- [ ] third task',
  '',
].join('\n');

test('listCheckboxes finds every checkbox in document order, ignoring plain bullets', () => {
  const items = listCheckboxes(SAMPLE);
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.text), ['first task', 'second task, already done', 'third task']);
  assert.deepEqual(items.map((i) => i.completed), [false, true, false]);
  assert.deepEqual(items.map((i) => i.index), [0, 1, 2]);
});

test('toggleCheckbox flips [ ] to [x] and back by index', () => {
  const toggledOn = toggleCheckbox(SAMPLE, 0);
  assert.deepEqual(listCheckboxes(toggledOn).map((i) => i.completed), [true, true, false]);

  const toggledOff = toggleCheckbox(toggledOn, 1);
  assert.deepEqual(listCheckboxes(toggledOff).map((i) => i.completed), [true, false, false]);
});

test('toggleCheckbox throws for an out-of-range index', () => {
  assert.throws(() => toggleCheckbox(SAMPLE, 99), /No checkbox at index 99/);
});
