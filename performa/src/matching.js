'use strict';

// Zero-dependency, no-API-key topic suggestion: score existing topics by
// keyword overlap with the text being captured, weighting a hit against the
// topic's title/tags higher than a hit in the body. This is a *suggestion*
// the UI shows alongside a manual picker — it doesn't have to be perfect.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'for', 'with', 'as', 'by', 'at', 'from', 'that', 'this', 'it', 'its',
  'i', 'you', 'we', 'they', 'he', 'she', 'them', 'their', 'my', 'your', 'our', 'about', 'into',
  'so', 'not', 'no', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will', 'just',
  'have', 'has', 'had', 'up', 'out', 'than', 'then', 'when', 'what', 'which', 'who', 'how',
]);

/** Lowercase, alphanumeric tokens of length >= 3, minus stopwords. Returns a Set. */
function tokenize(text) {
  const words = (text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  return new Set(words.filter((w) => w.length >= 3 && !STOPWORDS.has(w)));
}

/**
 * Score how well `captureTokens` matches one topic: title/tag hits count
 * triple, body hits count once, normalized by capture size so short and
 * long captures are comparable.
 */
function scoreTopic(captureTokens, topic) {
  if (captureTokens.size === 0) return 0;
  const titleTokens = tokenize(`${topic.title} ${(topic.tags || []).join(' ')}`);
  const bodyTokens = tokenize(topic.content || '');

  let weighted = 0;
  for (const token of captureTokens) {
    if (titleTokens.has(token)) weighted += 3;
    else if (bodyTokens.has(token)) weighted += 1;
  }
  return weighted / (captureTokens.size * 3);
}

/** Ranked [{ slug, title, score }], highest first, filtered to a minimum score. */
function suggestTopics(captureText, topics, { limit = 5, minScore = 0.08 } = {}) {
  const captureTokens = tokenize(captureText);
  return topics
    .map((topic) => ({ slug: topic.slug, title: topic.title, score: scoreTopic(captureTokens, topic) }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { tokenize, scoreTopic, suggestTopics };
