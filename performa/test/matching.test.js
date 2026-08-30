'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { tokenize, scoreTopic, suggestTopics } = require('../src/matching');

test('tokenize lowercases, drops short words and stopwords', () => {
  const tokens = tokenize('The Van Halen brown M&Ms clause is a great example');
  assert.ok(tokens.has('van'));
  assert.ok(tokens.has('halen'));
  assert.ok(tokens.has('brown'));
  assert.ok(tokens.has('clause'));
  assert.ok(tokens.has('great'));
  assert.ok(tokens.has('example'));
  assert.ok(!tokens.has('the'));
  assert.ok(!tokens.has('is'));
  assert.ok(!tokens.has('a'));
});

test('scoreTopic weights title/tag matches higher than body matches', () => {
  const titleHit = { title: 'Systems Thinking', tags: [], content: '' };
  const bodyHit = { title: 'Unrelated', tags: [], content: 'this is about systems and thinking' };

  const captureTokens = tokenize('a story about systems thinking');
  assert.ok(scoreTopic(captureTokens, titleHit) > scoreTopic(captureTokens, bodyHit));
});

test('scoreTopic returns 0 for an empty capture', () => {
  assert.equal(scoreTopic(new Set(), { title: 'Anything', tags: [], content: '' }), 0);
});

test('suggestTopics ranks by score and filters out weak matches', () => {
  const topics = [
    { slug: 'systems-thinking', title: 'Systems Thinking', tags: ['feedback'], content: 'canary signals and tripwires' },
    { slug: 'cooking', title: 'Cooking', tags: [], content: 'pasta recipes' },
  ];
  const results = suggestTopics(
    "Van Halen's brown M&Ms clause is a canary signal — a classic systems thinking example",
    topics
  );
  assert.deepEqual(results.map((r) => r.slug), ['systems-thinking']);
});

test('suggestTopics respects the limit', () => {
  const topics = Array.from({ length: 10 }, (_, i) => ({
    slug: `topic-${i}`,
    title: 'Systems Thinking',
    tags: [],
    content: '',
  }));
  const results = suggestTopics('systems thinking', topics, { limit: 3 });
  assert.equal(results.length, 3);
});
