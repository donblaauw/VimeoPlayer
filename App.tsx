import React, { useEffect, useState } from 'react';
import VimeoPlayer from './components/VimeoPlayer';
import { VIDEO_CONFIG } from './constants';

const App: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  
  // Initialize videoId state.
  // - If URL query is numeric, use it immediately (fastest).
  // - If URL query is a link, set to null initially to trigger async resolution.
  // - If empty or invalid, use default.
  const [videoId, setVideoId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = window.location.search;
      if (searchParams && searchParams.length > 1) {
        const query = searchParams.substring(1); // Remove '?'
        const decoded = decodeURIComponent(query).trim();
        
        // If it's a simple ID (digits only), return it immediately for instant playback
        if (/^\d+$/.test(decoded)) {
          return decoded;
        }
        
        // If it looks like a Vimeo URL, return null to signal we need to resolve it
        if (decoded.includes('vimeo.com')) {
          return null; 
        }
      }
    }
    return VIDEO_CONFIG.id;
  });

  useEffect(() => {
    setMounted(true);

    // If videoId is null, it means we have a URL query that needs resolving
    if (videoId === null) {
      const resolveVimeoUrl = async () => {
        try {
          const searchParams = window.location.search;
          const query = searchParams.substring(1);
          const decodedUrl = decodeURIComponent(query).trim();
          
          // Vimeo oEmbed endpoint helps us get the ID from a URL (e.g. vanity URLs, showcases)
          const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(decodedUrl)}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.video_id) {
              setVideoId(String(data.video_id));
              return;
            }
          }
        } catch (e) {
          console.error("Could not resolve Vimeo URL", e);
        }
        // Fallback to default if resolution fails
        setVideoId(VIDEO_CONFIG.id);
      };

      resolveVimeoUrl();
    }
  }, [videoId]);

  if (!mounted) return null;

  return (
    <main className="fixed inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden z-0">
      {/* Only render player once we have a valid ID. If loading (null), screen stays black. */}
      {videoId ? <VimeoPlayer videoId={videoId} /> : null}
    </main>
  );
};

export default App;