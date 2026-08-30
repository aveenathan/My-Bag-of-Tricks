'use strict';

/**
 * Heuristic "AI slop" detector for YouTube search results.
 *
 * Nothing here calls out to a model — it's a set of cheap, explainable
 * signals (title/channel/description patterns) that tend to correlate with
 * mass-produced, low-effort, AI-generated filler content aimed at kids
 * (rage-bait titles, "AI generated storytime" channels, keyword-stuffed
 * descriptions, freshly-spun channel names like "KidsFunTV38217", etc).
 *
 * Every signal that fires is returned as a human-readable reason, so a
 * parent reviewing the "borderline" queue can see exactly *why* a video was
 * flagged instead of trusting a black box.
 */

// Wide emoji ranges covering the common blocks used in spammy titles.
const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;

const CLICKBAIT_PHRASES = [
  "you won't believe",
  'you wont believe',
  'must watch',
  'gone wrong',
  'shocking',
  "you have to see this",
  'this will blow your mind',
  'not clickbait',
  '100% real',
  'insane',
  'number 1 will shock you',
  "wait for it",
  'like and subscribe',
];

// Phrases that are, ironically, often used by AI-slop channels to *announce*
// the content is AI generated (reused/auto-uploaded storytime, TTS voice, etc.)
const AI_DISCLOSURE_PHRASES = [
  'ai generated',
  'ai-generated',
  'made with ai',
  'made using ai',
  'created by ai',
  'ai voice over',
  'ai voiceover',
  'text to speech story',
  'text-to-speech story',
  'ai animation',
  'no copyright ai',
  'artificial intelligence voice',
];

const LOW_EFFORT_CHANNEL_KEYWORDS = [
  'compilation',
  'shorts factory',
  'auto upload',
  'best clips daily',
  'viral now',
  'daily upload',
  'story time ai',
  'storytime ai',
  'clips tv',
];

// Generic word(s) immediately followed by 4+ digits, e.g. "KidsFunTV38217"
// or "ToysPlay9284" — a common pattern for mass-produced channel farms.
const GENERIC_CHANNEL_DIGIT_SUFFIX = /^[a-z]{4,}\d{4,}$/i;

function countEmoji(text) {
  const matches = text.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
}

function capsWordRatio(text) {
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length === 0) return 0;
  const shouting = words.filter((w) => w.length >= 3 && w === w.toUpperCase());
  return shouting.length / words.length;
}

function containsAny(haystack, needles) {
  const lower = haystack.toLowerCase();
  return needles.filter((n) => lower.includes(n));
}

function countHashtags(text) {
  const matches = text.match(/#\w+/g);
  return matches ? matches.length : 0;
}

function hasRepeatedPunctuation(text) {
  return /[!?]{3,}/.test(text);
}

/**
 * Detect keyword-stuffing: the same significant (4+ letter) word repeated
 * an excessive number of times in a block of text.
 */
function hasKeywordStuffing(text, minRepeats = 6) {
  const counts = new Map();
  const words = text.toLowerCase().match(/[a-z]{4,}/g) || [];
  for (const w of words) {
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  for (const [word, count] of counts) {
    if (count >= minRepeats) return word;
  }
  return null;
}

/**
 * Score a single normalized video against the heuristics.
 *
 * @param {{id: string, title: string, description: string, channelId: string, channelTitle: string}} video
 * @param {{threshold: number, allowlistChannelIds: string[], blocklistChannelIds: string[], blocklistKeywords: string[]}} lists
 * @returns {{score: number, reasons: {signal: string, weight: number, detail: string}[], verdict: 'allowed'|'borderline'|'blocked', forced: boolean}}
 */
function evaluateVideo(video, lists) {
  const title = video.title || '';
  const description = video.description || '';
  const channelTitle = video.channelTitle || '';
  const channelId = video.channelId || '';

  const allowlist = lists.allowlistChannelIds || [];
  const blocklist = lists.blocklistChannelIds || [];
  const blockedKeywords = lists.blocklistKeywords || [];
  const threshold = lists.threshold ?? 4;

  if (allowlist.includes(channelId)) {
    return {
      score: 0,
      reasons: [
        {
          signal: 'allowlisted-channel',
          weight: 0,
          detail: `"${channelTitle}" is on the trusted channel allowlist.`,
        },
      ],
      verdict: 'allowed',
      forced: true,
    };
  }

  if (blocklist.includes(channelId)) {
    return {
      score: Infinity,
      reasons: [
        {
          signal: 'blocklisted-channel',
          weight: Infinity,
          detail: `"${channelTitle}" is on the blocked channel list.`,
        },
      ],
      verdict: 'blocked',
      forced: true,
    };
  }

  const reasons = [];
  let score = 0;

  const emojiCount = countEmoji(title);
  if (emojiCount >= 3) {
    score += 2;
    reasons.push({
      signal: 'emoji-spam',
      weight: 2,
      detail: `Title has ${emojiCount} emoji.`,
    });
  }

  const capsRatio = capsWordRatio(title);
  if (capsRatio > 0.5 && title.length > 10) {
    score += 2;
    reasons.push({
      signal: 'shouting-title',
      weight: 2,
      detail: `${Math.round(capsRatio * 100)}% of the title's words are ALL CAPS.`,
    });
  }

  if (hasRepeatedPunctuation(title)) {
    score += 1;
    reasons.push({
      signal: 'repeated-punctuation',
      weight: 1,
      detail: 'Title uses repeated "!!!" or "???" for emphasis.',
    });
  }

  const clickbaitHits = containsAny(title, CLICKBAIT_PHRASES);
  if (clickbaitHits.length > 0) {
    score += 2;
    reasons.push({
      signal: 'clickbait-phrase',
      weight: 2,
      detail: `Title contains clickbait phrasing: "${clickbaitHits[0]}".`,
    });
  }

  const aiDisclosureHits = [
    ...containsAny(title, AI_DISCLOSURE_PHRASES),
    ...containsAny(description, AI_DISCLOSURE_PHRASES),
  ];
  if (aiDisclosureHits.length > 0) {
    score += 3;
    reasons.push({
      signal: 'ai-disclosure-phrase',
      weight: 3,
      detail: `Content references AI generation: "${aiDisclosureHits[0]}".`,
    });
  }

  const keywordBlockHits = containsAny(
    `${title} ${description}`,
    blockedKeywords.map((k) => k.toLowerCase())
  );
  if (keywordBlockHits.length > 0) {
    score += 3;
    reasons.push({
      signal: 'blocked-keyword',
      weight: 3,
      detail: `Matched a parent-configured blocked keyword: "${keywordBlockHits[0]}".`,
    });
  }

  const channelKeywordHits = containsAny(channelTitle, LOW_EFFORT_CHANNEL_KEYWORDS);
  if (channelKeywordHits.length > 0) {
    score += 2;
    reasons.push({
      signal: 'low-effort-channel-name',
      weight: 2,
      detail: `Channel name matches a known low-effort pattern: "${channelKeywordHits[0]}".`,
    });
  }

  if (GENERIC_CHANNEL_DIGIT_SUFFIX.test(channelTitle.replace(/\s+/g, ''))) {
    score += 2;
    reasons.push({
      signal: 'generic-channel-name',
      weight: 2,
      detail: `Channel name "${channelTitle}" looks auto-generated (generic word + digits).`,
    });
  }

  const hashtagCount = countHashtags(description);
  if (hashtagCount > 8) {
    score += 2;
    reasons.push({
      signal: 'hashtag-stuffing',
      weight: 2,
      detail: `Description has ${hashtagCount} hashtags.`,
    });
  }

  const stuffedWord = hasKeywordStuffing(description);
  if (stuffedWord) {
    score += 2;
    reasons.push({
      signal: 'keyword-stuffing',
      weight: 2,
      detail: `Description repeats the word "${stuffedWord}" excessively.`,
    });
  }

  let verdict = 'allowed';
  if (score >= threshold) verdict = 'blocked';
  else if (score > 0) verdict = 'borderline';

  return { score, reasons, verdict, forced: false };
}

/**
 * Evaluate a list of videos and split them into allowed / borderline / blocked
 * buckets, each annotated with its score and reasons.
 */
function filterVideos(videos, lists) {
  const evaluated = videos.map((video) => ({
    video,
    ...evaluateVideo(video, lists),
  }));

  return {
    allowed: evaluated.filter((v) => v.verdict === 'allowed'),
    borderline: evaluated.filter((v) => v.verdict === 'borderline'),
    blocked: evaluated.filter((v) => v.verdict === 'blocked'),
  };
}

module.exports = {
  evaluateVideo,
  filterVideos,
  // exported for tests / tuning
  countEmoji,
  capsWordRatio,
  hasKeywordStuffing,
};
