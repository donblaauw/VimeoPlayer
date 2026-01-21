export interface VimeoPlayerProps {
  videoId: string;
  className?: string;
}

export interface VimeoEmbedParams {
  [key: string]: string;
}

declare global {
  interface Window {
    Vimeo: any;
  }
}