'use strict';

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

/**
 * Search YouTube for kid-appropriate, embeddable videos.
 *
 * Applies YouTube's own SafeSearch=strict at the API level as a baseline —
 * the heuristic AI-slop filter in aiSlopFilter.js runs on top of these
 * results, it doesn't replace platform-level safety filtering.
 *
 * @param {string} query
 * @param {{ apiKey: string, maxResults?: number }} opts
 * @returns {Promise<Array<{id: string, title: string, description: string, channelId: string, channelTitle: string, publishedAt: string, thumbnail: string}>>}
 */
async function searchVideos(query, { apiKey, maxResults = 25 } = {}) {
  if (!apiKey) {
    throw new Error(
      'Missing YOUTUBE_API_KEY. Set it in your environment (see .env.example) before searching.'
    );
  }

  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('safeSearch', 'strict');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('key', apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`YouTube API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();

  return (data.items || [])
    .filter((item) => item.id && item.id.videoId)
    .map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description || '',
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnail:
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        '',
    }));
}

module.exports = { searchVideos };
