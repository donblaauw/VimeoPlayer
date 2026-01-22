export const VIDEO_CONFIG = {
  id: '1157009946',
  appId: '58479',
  title: 'De Heerlijkheid Rosande'
};

/**
 * Vimeo Player Embed Options
 * - autoplay=0: We handle start manually to ensure audio context is ready
 * - muted=0: We want audio
 * - controls=0: Hide the player chrome (interface)
 * - playsinline=1: Prevent iOS from forcing native full screen player
 * - dnt=1: Do Not Track
 * - loop=0: Stop at end to show start screen
 */
export const VIMEO_PARAMS = {
  autoplay: '0',
  muted: '0',
  controls: '0',
  playsinline: '1',
  title: '0',
  byline: '0',
  portrait: '0',
  badge: '0',
  autopause: '0',
  dnt: '1',
  loop: '0' 
};