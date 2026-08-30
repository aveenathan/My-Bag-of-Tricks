'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { generateTryOn } = require('../src/openaiClient');

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('generateTryOn rejects when no API key is configured', async () => {
  await assert.rejects(
    generateTryOn({ selfieDataUrl: TINY_PNG, dressDataUrl: TINY_PNG, apiKey: '' }),
    /No OpenAI API key configured/
  );
});

test('generateTryOn validates the input images before calling the network', async () => {
  const fetchImpl = () => {
    throw new Error('fetch should not be called for invalid input');
  };
  await assert.rejects(
    generateTryOn({ selfieDataUrl: 'not-a-data-url', dressDataUrl: TINY_PNG, apiKey: 'sk-test', fetchImpl }),
    /base64-encoded data URL/
  );
});

test('generateTryOn returns a data URL built from the API response', async () => {
  const fakeB64 = Buffer.from('fake-image-bytes').toString('base64');
  const fetchImpl = async (url, opts) => {
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.equal(opts.headers.Authorization, 'Bearer sk-test');
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: fakeB64 }] }),
    };
  };

  const image = await generateTryOn({
    selfieDataUrl: TINY_PNG,
    dressDataUrl: TINY_PNG,
    apiKey: 'sk-test',
    fetchImpl,
  });
  assert.equal(image, `data:image/png;base64,${fakeB64}`);
});

test('generateTryOn surfaces the API error message on failure', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { message: 'Invalid image size.' } }),
  });

  await assert.rejects(
    generateTryOn({ selfieDataUrl: TINY_PNG, dressDataUrl: TINY_PNG, apiKey: 'sk-test', fetchImpl }),
    /Invalid image size\./
  );
});
