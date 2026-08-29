'use strict';

/**
 * Canned sample results used when YOUTUBE_API_KEY isn't set, so the app
 * (search → filter → play) can be tried out with no API key or network
 * quota at all. Thumbnails point at real, public YouTube video IDs (just
 * for a working image); titles/descriptions/channel names are crafted to
 * exercise the filter's different signals for demo purposes.
 */
const SAMPLE_VIDEOS = [
  {
    id: 'dQw4w9WgXcQ',
    title: 'Learning About Dinosaurs for Kids',
    description: 'A short educational video about the Jurassic period, made by a local museum.',
    channelId: 'UC_demo_museum',
    channelTitle: 'City Science Museum',
    publishedAt: '2024-03-01T00:00:00Z',
  },
  {
    id: '9bZkp7q19f0',
    title: 'How Volcanoes Work — Science for Kids',
    description: 'A calm, illustrated explanation of how volcanoes form and erupt.',
    channelId: 'UC_demo_natgeo',
    channelTitle: 'Explorer Kids',
    publishedAt: '2024-05-12T00:00:00Z',
  },
  {
    id: 'kJQP7kiw5Fk',
    title: 'Simple Paper Airplane Tutorial',
    description: 'Step-by-step folding instructions for a classic paper airplane.',
    channelId: 'UC_demo_craft',
    channelTitle: 'Craft Corner',
    publishedAt: '2024-01-20T00:00:00Z',
  },
  {
    id: 'L_jWHffIx5E',
    title: "🔥🔥🔥 YOU WON'T BELIEVE WHAT HAPPENS NEXT !!! 😱😱",
    description: 'watch now before it gets taken down subscribe subscribe subscribe',
    channelId: 'UC_demo_slop1',
    channelTitle: 'FunClipsTV38217',
    publishedAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'fJ9rUzIMcZQ',
    title: 'Bedtime Story (AI Generated) — Sleep Fast',
    description: 'Made with AI voice over. Text to speech story for kids, auto-uploaded daily.',
    channelId: 'UC_demo_slop2',
    channelTitle: 'Storytime AI',
    publishedAt: '2024-06-02T00:00:00Z',
  },
  {
    id: 'e-ORhEE9VVg',
    title: 'Learn Colors with Surprise Eggs Unboxing 100',
    description: 'unboxing surprise toys for kids #toys #kids #fun',
    channelId: 'UC_demo_slop3',
    channelTitle: 'Unboxing World',
    publishedAt: '2024-06-03T00:00:00Z',
  },
  {
    id: 'YQHsXMglC9A',
    title: 'Amazing Park Adventure!!!',
    description: 'A calm walk through the park with the family, looking at birds and trees.',
    channelId: 'UC_demo_borderline',
    channelTitle: 'Family Adventures',
    publishedAt: '2024-04-15T00:00:00Z',
  },
];

module.exports = { SAMPLE_VIDEOS };
