export const VIDEO_CONFIG = {
  id: '1157009946',
  appId: '58479',
  title: 'De Heerlijkheid Rosande'
};

/**
 * Vimeo Player Embed Options
 * - autoplay=1: Attempt to start immediately
 * - muted=1: Required for autoplay on most mobile browsers
 * - controls=0: Hide the player chrome (interface)
 * - playsinline=1: Prevent iOS from forcing native full screen player
 * - title=0: Hide video title
 * - byline=0: Hide author
 * - portrait=0: Hide author portrait
 * - dnt=1: Do Not Track
 * - loop=1: Loop the video (often desired for interface-less displays, customizable)
 */
export const VIMEO_PARAMS = {
  autoplay: '1',
  muted: '1', // Crucial for immediate playback on mobile
  controls: '0',
  playsinline: '1',
  title: '0',
  byline: '0',
  portrait: '0',
  badge: '0',
  autopause: '0',
  dnt: '1',
  loop: '1' 
};