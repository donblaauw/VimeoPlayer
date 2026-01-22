export interface VimeoPlayerProps {
  videoId: string;
  provider: 'vimeo' | 'youtube';
  className?: string;
}

export interface VimeoEmbedParams {
  [key: string]: string;
}

declare global {
  interface Window {
    Vimeo: any;
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}