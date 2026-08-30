'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateVideo, filterVideos } = require('../src/aiSlopFilter');

const baseLists = {
  threshold: 4,
  allowlistChannelIds: [],
  blocklistChannelIds: [],
  blocklistKeywords: [],
};

test('a normal, well-described video is allowed with score 0', () => {
  const video = {
    id: 'v1',
    title: 'Learning about dinosaurs for kids',
    description: 'A short educational video about the Jurassic period, made by a local museum.',
    channelId: 'UC_museum',
    channelTitle: 'City Science Museum',
  };
  const result = evaluateVideo(video, baseLists);
  assert.equal(result.verdict, 'allowed');
  assert.equal(result.score, 0);
});

test('emoji spam + shouting title + clickbait phrase is blocked', () => {
  const video = {
    id: 'v2',
    title: '🔥🔥🔥 YOU WONT BELIEVE WHAT HAPPENS NEXT !!! 😱😱',
    description: 'watch now',
    channelId: 'UC_random',
    channelTitle: 'Fun Channel',
  };
  const result = evaluateVideo(video, baseLists);
  assert.equal(result.verdict, 'blocked');
  assert.ok(result.score >= baseLists.threshold);
  const signals = result.reasons.map((r) => r.signal);
  assert.ok(signals.includes('emoji-spam'));
  assert.ok(signals.includes('shouting-title'));
  assert.ok(signals.includes('clickbait-phrase'));
});

test('channel name that looks auto-generated is flagged', () => {
  const video = {
    id: 'v3',
    title: 'Kids story time',
    description: 'A calm bedtime story.',
    channelId: 'UC_gen',
    channelTitle: 'KidsFunTV38217',
  };
  const result = evaluateVideo(video, baseLists);
  assert.ok(result.reasons.some((r) => r.signal === 'generic-channel-name'));
});

test('explicit AI-disclosure phrases score heavily', () => {
  const video = {
    id: 'v4',
    title: 'Bedtime story (AI generated)',
    description: 'Made with AI voice over, text to speech story for kids.',
    channelId: 'UC_ai',
    channelTitle: 'Storytime AI',
  };
  const result = evaluateVideo(video, baseLists);
  assert.equal(result.verdict, 'blocked');
  assert.ok(result.reasons.some((r) => r.signal === 'ai-disclosure-phrase'));
});

test('hashtag stuffing and keyword-stuffed descriptions are flagged', () => {
  const video = {
    id: 'v5',
    title: 'Fun video',
    description:
      'subscribe subscribe subscribe subscribe subscribe subscribe now ' +
      '#kids #fun #video #viral #subscribe #like #share #comment #trending #more',
    channelId: 'UC_spam',
    channelTitle: 'Video Channel',
  };
  const result = evaluateVideo(video, baseLists);
  const signals = result.reasons.map((r) => r.signal);
  assert.ok(signals.includes('hashtag-stuffing'));
  assert.ok(signals.includes('keyword-stuffing'));
});

test('allowlisted channel bypasses all heuristics', () => {
  const video = {
    id: 'v6',
    title: '🔥🔥🔥 YOU WONT BELIEVE THIS !!!',
    description: 'AI generated shocking video',
    channelId: 'UC_trusted',
    channelTitle: 'Trusted Kids Channel',
  };
  const lists = { ...baseLists, allowlistChannelIds: ['UC_trusted'] };
  const result = evaluateVideo(video, lists);
  assert.equal(result.verdict, 'allowed');
  assert.equal(result.forced, true);
});

test('blocklisted channel is always blocked regardless of content', () => {
  const video = {
    id: 'v7',
    title: 'A perfectly normal, calm video title',
    description: 'Nothing suspicious here at all.',
    channelId: 'UC_blocked',
    channelTitle: 'Blocked Channel',
  };
  const lists = { ...baseLists, blocklistChannelIds: ['UC_blocked'] };
  const result = evaluateVideo(video, lists);
  assert.equal(result.verdict, 'blocked');
  assert.equal(result.forced, true);
});

test('parent-configured blocklist keywords flag matching videos', () => {
  const video = {
    id: 'v8',
    title: 'Learn Colors with Surprise Eggs Unboxing 100',
    description: 'unboxing fun',
    channelId: 'UC_unbox',
    channelTitle: 'Unboxing Channel',
  };
  const lists = { ...baseLists, blocklistKeywords: ['learn colors with'] };
  const result = evaluateVideo(video, lists);
  assert.ok(result.reasons.some((r) => r.signal === 'blocked-keyword'));
});

test('a video with one mild signal is borderline, not blocked', () => {
  const video = {
    id: 'v9',
    title: 'Amazing park adventure!!!',
    description: 'A calm walk through the park with the family.',
    channelId: 'UC_mild',
    channelTitle: 'Family Adventures',
  };
  const result = evaluateVideo(video, baseLists);
  assert.equal(result.verdict, 'borderline');
  assert.ok(result.score > 0 && result.score < baseLists.threshold);
});

test('filterVideos buckets a mixed list correctly', () => {
  const videos = [
    {
      id: 'a',
      title: 'Normal educational video',
      description: 'Calm and informative.',
      channelId: 'UC_a',
      channelTitle: 'Learning Channel',
    },
    {
      id: 'b',
      title: '🔥🔥🔥 SHOCKING !!! YOU WONT BELIEVE',
      description: 'ai generated',
      channelId: 'UC_b',
      channelTitle: 'SlopTV99182',
    },
  ];
  const { allowed, borderline, blocked } = filterVideos(videos, baseLists);
  assert.equal(allowed.length, 1);
  assert.equal(borderline.length + blocked.length, 1);
  assert.equal(blocked[0].video.id, 'b');
});

test('raising the threshold moves a mildly-flagged video from blocked to borderline', () => {
  const video = {
    id: 'v10',
    title: 'Amazing park adventure!!!',
    description: 'A calm walk through the park.',
    channelId: 'UC_mild2',
    channelTitle: 'Family Adventures',
  };
  const strict = evaluateVideo(video, { ...baseLists, threshold: 1 });
  const lenient = evaluateVideo(video, { ...baseLists, threshold: 10 });
  assert.equal(strict.verdict, 'blocked');
  assert.equal(lenient.verdict, 'borderline');
  assert.equal(strict.score, lenient.score);
});
