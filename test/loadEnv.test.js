'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadEnvFile } = require('../src/loadEnv');

function withTempEnvFile(contents, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidytube-env-'));
  const filePath = path.join(dir, '.env');
  fs.writeFileSync(filePath, contents);
  try {
    fn(filePath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('loads simple KEY=VALUE lines into process.env', () => {
  withTempEnvFile('FOO_TEST_KEY=hello\nBAR_TEST_KEY=world\n', (filePath) => {
    delete process.env.FOO_TEST_KEY;
    delete process.env.BAR_TEST_KEY;
    loadEnvFile(filePath);
    assert.equal(process.env.FOO_TEST_KEY, 'hello');
    assert.equal(process.env.BAR_TEST_KEY, 'world');
  });
});

test('ignores comments and blank lines', () => {
  withTempEnvFile('# a comment\n\nCOMMENT_TEST_KEY=value\n', (filePath) => {
    delete process.env.COMMENT_TEST_KEY;
    loadEnvFile(filePath);
    assert.equal(process.env.COMMENT_TEST_KEY, 'value');
  });
});

test('strips matching surrounding quotes', () => {
  withTempEnvFile('QUOTED_TEST_KEY="quoted value"\nSINGLE_TEST_KEY=\'single\'\n', (filePath) => {
    delete process.env.QUOTED_TEST_KEY;
    delete process.env.SINGLE_TEST_KEY;
    loadEnvFile(filePath);
    assert.equal(process.env.QUOTED_TEST_KEY, 'quoted value');
    assert.equal(process.env.SINGLE_TEST_KEY, 'single');
  });
});

test('does not overwrite an already-set environment variable', () => {
  withTempEnvFile('OVERRIDE_TEST_KEY=from-file\n', (filePath) => {
    process.env.OVERRIDE_TEST_KEY = 'from-real-env';
    loadEnvFile(filePath);
    assert.equal(process.env.OVERRIDE_TEST_KEY, 'from-real-env');
    delete process.env.OVERRIDE_TEST_KEY;
  });
});

test('does nothing (no throw) when the file does not exist', () => {
  assert.doesNotThrow(() => loadEnvFile('/nonexistent/path/.env'));
});
