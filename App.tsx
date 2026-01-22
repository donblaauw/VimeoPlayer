import React, { useEffect, useState } from 'react';
import VimeoPlayer from './components/VimeoPlayer';
import { VIDEO_CONFIG } from './constants';

const App: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [videoData, setVideoData] = useState<{ id: string; provider: 'vimeo' | 'youtube' } | null>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = window.location.search;
      if (searchParams && searchParams.length > 1) {
        const query = searchParams.substring(1); 
        const decoded = decodeURIComponent(query).trim();
        
        // 1. Check for simple numeric ID (Assume Vimeo)
        if (/^\d+$/.test(decoded)) {
          return { id: decoded, provider: 'vimeo' };
        }

        // 2. Check for YouTube URL
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const ytMatch = decoded.match(ytRegex);
        if (ytMatch && ytMatch[1]) {
            return { id: ytMatch[1], provider: 'youtube' };
        }
        
        // 3. Check for Vimeo URL (needs resolution)
        if (decoded.includes('vimeo.com')) {
          return null; // Trigger async resolution
        }
      }
    }
    // Default fallback
    return { id: VIDEO_CONFIG.id, provider: 'vimeo' };
  });

  useEffect(() => {
    setMounted(true);

    if (videoData === null) {
      const resolveVimeoUrl = async () => {
        try {
          const searchParams = window.location.search;
          const query = searchParams.substring(1);
          const decodedUrl = decodeURIComponent(query).trim();
          
          const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(decodedUrl)}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.video_id) {
              setVideoData({ id: String(data.video_id), provider: 'vimeo' });
              return;
            }
          }
        } catch (e) {
          console.error("Could not resolve Vimeo URL", e);
        }
        setVideoData({ id: VIDEO_CONFIG.id, provider: 'vimeo' });
      };

      resolveVimeoUrl();
    }
  }, [videoData]);

  if (!mounted) return null;

  return (
    // Use h-[100dvh] to account for mobile browser bars dynamically
    <main className="fixed inset-0 w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden z-0">
      {videoData ? (
        <VimeoPlayer videoId={videoData.id} provider={videoData.provider} />
      ) : null}
    </main>
  );
};

export default App;