import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VimeoPlayerProps, VimeoEmbedParams } from '../types';
import { VIMEO_PARAMS, VIDEO_CONFIG } from '../constants';

const UniversalPlayer: React.FC<VimeoPlayerProps> = ({ videoId, provider, className = '' }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const embedContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const checkYTInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Player State
  // Default to true so controls (play button) are available immediately if autoplay fails
  const [hasStarted, setHasStarted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [videoTitle, setVideoTitle] = useState(VIDEO_CONFIG.title);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Initialize with 16:9 aspect ratio (standard) to prevent "black bar" locking on mobile load.
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);

  const [videoDimensions, setVideoDimensions] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1920, 
    height: typeof window !== 'undefined' ? window.innerHeight : 1080 
  });

  // --- 1. Sizing Logic (Strict Cover / Zen Mode) ---
  const calculateDimensions = useCallback((containerWidth: number, containerHeight: number, aspect: number) => {
    const containerAspect = containerWidth / containerHeight;
    let width, height;

    if (containerAspect > aspect) {
      // Container is wider than video -> Match Width (Cropping Top/Bottom)
      width = containerWidth;
      height = containerWidth / aspect;
    } else {
      // Container is taller than video -> Match Height (Cropping Left/Right)
      height = containerHeight;
      width = containerHeight * aspect;
    }

    // OVERSCAN: Add 2% buffer to ensure edge-to-edge coverage even with rounding errors
    return {
        width: Math.ceil(width * 1.02),
        height: Math.ceil(height * 1.02)
    };
  }, []);

  const handleResize = useCallback(() => {
    if (!wrapperRef.current) return;
    const { clientWidth, clientHeight } = wrapperRef.current;
    
    // Fallback to window if wrapper is 0 (hidden or unmounted)
    const w = clientWidth || window.innerWidth;
    const h = clientHeight || window.innerHeight;
    
    setVideoDimensions(calculateDimensions(w, h, videoAspectRatio));
  }, [videoAspectRatio, calculateDimensions]);

  // Use ResizeObserver for robust layout tracking
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            setVideoDimensions(calculateDimensions(width, height, videoAspectRatio));
        }
    });

    resizeObserver.observe(wrapperRef.current);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize, videoAspectRatio, calculateDimensions]);

  // --- 2. Data Fetching ---
  useEffect(() => {
    const fetchInfo = async () => {
      setVideoTitle(''); 
      setThumbnailUrl(null);

      if (provider === 'vimeo') {
        try {
          const response = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.title) setVideoTitle(data.title);
            
            // Extract real aspect ratio if available
            if (data.width && data.height) {
                setVideoAspectRatio(data.width / data.height);
            }

            const thumb = data.thumbnail_url_with_play_button || data.thumbnail_url;
            setThumbnailUrl(thumb ? thumb.replace(/_\d+\.jpg/, '.jpg') : null);
          }
        } catch (e) { console.error(e); }
      } else if (provider === 'youtube') {
        try {
            const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.title) setVideoTitle(data.title);
                if (data.width && data.height) {
                    setVideoAspectRatio(data.width / data.height);
                }
                const maxResThumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                setThumbnailUrl(maxResThumb);
            }
        } catch(e) { console.error(e); }
      }
    };
    fetchInfo();
  }, [videoId, provider]);


  // --- 3. Player Initialization ---
  useEffect(() => {
    if (!embedContainerRef.current) return;

    // Reset State
    setHasStarted(true); // Always true, we skip the preview screen
    setIsPlaying(false);
    setProgress(0);
    
    let vimeoPlayer: any = null;
    let ytPlayer: any = null;
    let syncInterval: ReturnType<typeof setInterval>;

    const setupVimeo = () => {
        if (!window.Vimeo) return;
        embedContainerRef.current!.innerHTML = '';
        const videoDiv = document.createElement('div');
        videoDiv.style.width = '100%';
        videoDiv.style.height = '100%'; 
        embedContainerRef.current!.appendChild(videoDiv);

        const params: VimeoEmbedParams = {
            ...VIMEO_PARAMS,
            id: videoId,
            player_id: '0',
            app_id: VIDEO_CONFIG.appId,
            controls: '0',
            background: '0', 
            autoplay: '0', // Manual start in ready()
            muted: '0',
            playsinline: '1',
            title: '0',
            byline: '0',
            portrait: '0'
        };

        vimeoPlayer = new window.Vimeo.Player(videoDiv, params);
        playerRef.current = vimeoPlayer;

        vimeoPlayer.ready().then(() => {
            Promise.all([vimeoPlayer.getVideoWidth(), vimeoPlayer.getVideoHeight()])
                .then(([w, h]) => { 
                    if (w && h) setVideoAspectRatio(w / h);
                }).catch(() => {});
            vimeoPlayer.getDuration().then((d: number) => setDuration(d));

            // AUTO START ATTEMPT
            vimeoPlayer.setVolume(1).catch(() => {});
            vimeoPlayer.setMuted(false).catch(() => {}); 
            vimeoPlayer.play().catch((e: any) => {
                console.warn("Autoplay blocked - user interaction required", e);
                // isPlaying remains false, triggering the UI play button to show
            });
        });

        vimeoPlayer.on('play', () => setIsPlaying(true));
        vimeoPlayer.on('pause', () => setIsPlaying(false));
        vimeoPlayer.on('timeupdate', (data: any) => setProgress(data.seconds));
        vimeoPlayer.on('ended', () => {
            setIsPlaying(false);
            setProgress(0);
            vimeoPlayer.setCurrentTime(0).catch(() => {});
            vimeoPlayer.pause().catch(() => {});
        });
    };

    const setupYouTube = () => {
        embedContainerRef.current!.innerHTML = '';
        const videoDiv = document.createElement('div');
        videoDiv.id = `yt-player-${videoId}`;
        videoDiv.style.width = '100%';
        videoDiv.style.height = '100%';
        embedContainerRef.current!.appendChild(videoDiv);

        const onPlayerReady = (event: any) => {
            setDuration(event.target.getDuration());
            // AUTO START ATTEMPT
            event.target.setVolume(100);
            event.target.unMute();
            event.target.playVideo();
        };

        const onStateChange = (event: any) => {
            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
            if (event.data === 1) setIsPlaying(true);
            if (event.data === 2) setIsPlaying(false);
            if (event.data === 0) {
                 setIsPlaying(false);
                 setProgress(0);
                 event.target.seekTo(0);
                 event.target.pauseVideo();
            }
        };

        const createPlayer = () => {
             ytPlayer = new window.YT.Player(videoDiv, {
                videoId: videoId,
                width: '100%',
                height: '100%',
                playerVars: {
                    playsinline: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    rel: 0,
                    modestbranding: 1,
                    iv_load_policy: 3
                },
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onStateChange
                }
            });
            playerRef.current = ytPlayer;
        };

        if (window.YT && window.YT.Player) {
            createPlayer();
        } else {
            // Poll for YT API
            if (checkYTInterval.current) clearInterval(checkYTInterval.current);
            checkYTInterval.current = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    if (checkYTInterval.current) clearInterval(checkYTInterval.current);
                    createPlayer();
                }
            }, 100);
        }
    };

    if (provider === 'vimeo') setupVimeo();
    else if (provider === 'youtube') setupYouTube();

    // SAFETY: Poll for play state to keep UI in sync
    syncInterval = setInterval(() => {
        if (provider === 'vimeo' && vimeoPlayer) {
            vimeoPlayer.getPaused().then((paused: boolean) => setIsPlaying(!paused)).catch(() => {});
            vimeoPlayer.getCurrentTime().then((t: number) => setProgress(t)).catch(() => {});
        } else if (provider === 'youtube' && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
            try {
                const ct = playerRef.current.getCurrentTime();
                if (typeof ct === 'number') setProgress(ct);
                
                const state = playerRef.current.getPlayerState();
                // 1 is playing, 3 is buffering (treat as playing for UI toggle purposes)
                setIsPlaying(state === 1 || state === 3);
            } catch (e) { /* ignore */ }
        }
    }, 1000);
    
    return () => {
        if (syncInterval) clearInterval(syncInterval);
        if (checkYTInterval.current) clearInterval(checkYTInterval.current);
        if (vimeoPlayer) vimeoPlayer.unload();
        if (ytPlayer && typeof ytPlayer.destroy === 'function') ytPlayer.destroy();
        playerRef.current = null;
    };
  }, [videoId, provider]);


  // --- 4. Controls Logic ---
  const showControlsTemporarily = useCallback(() => {
    // Always allow showing controls if we are in "started" mode (which is always true now)
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
    }, 3000);
  }, []); // removed dependency hasStarted

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;

    if (provider === 'vimeo') {
        player.getPaused().then((paused: boolean) => {
            if (paused) {
                player.setVolume(1).catch(() => {});
                player.setMuted(false).catch(() => {});
                player.play().catch((e: any) => console.error("Play failed", e));
                setIsPlaying(true);
            } else {
                player.pause().catch((e: any) => console.error("Pause failed", e));
                setIsPlaying(false);
            }
        });
    } else if (provider === 'youtube') {
        if (typeof player.getPlayerState !== 'function') return;
        const state = player.getPlayerState();
        if (state === 1 || state === 3) { // Playing or Buffering -> Pause
            player.pauseVideo();
            setIsPlaying(false);
        } else {
            player.unMute();
            player.setVolume(100);
            player.playVideo();
            setIsPlaying(true);
        }
    }
    
    showControlsTemporarily();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    const player = playerRef.current;
    
    if (player) {
        if (provider === 'vimeo') {
            player.setCurrentTime(time).catch(() => {});
        } else if (provider === 'youtube') {
            if (typeof player.seekTo === 'function') player.seekTo(time, true);
        }
    }
    showControlsTemporarily();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Logic: Controls are visible if explicitly shown (hover/tap) OR if video is NOT playing.
  const isControlsVisible = showControls || !isPlaying;

  return (
    <div 
        ref={wrapperRef}
        className={`relative w-full h-full overflow-hidden bg-black select-none ${className}`}
        style={{ 
            backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        }}
        onMouseMove={showControlsTemporarily}
        onTouchStart={showControlsTemporarily}
    >
      {/* 1. Video Layer - Centered & Sized to Cover */}
      <div 
        ref={embedContainerRef}
        className="absolute"
        style={{
            width: `${videoDimensions.width}px`,
            height: `${videoDimensions.height}px`,
            top: '50%',
            left: '50%',
            transform: 'translate3d(-50%, -50%, 0)', // Use translate3d for hardware acceleration
            opacity: 1, 
            zIndex: 10,
            pointerEvents: 'none' // CRITICAL: Ensure iframe never steals touch events
        }}
      />
      {/* Force inner iframe to block level and full size via style injection if needed */}
      <style>{`
        iframe { 
            width: 100% !important; 
            height: 100% !important; 
            display: block !important;
            pointer-events: none !important; /* Double safety */
        }
      `}</style>

      {/* 2. Controls Layer */}
      {/* Click area for toggling play/pause - Covers entire screen below UI controls */}
      <div 
          className="absolute inset-0 z-30 cursor-pointer bg-transparent" 
          onClick={togglePlay}
      ></div>
      
      <div 
          className={`absolute inset-0 z-40 flex flex-col justify-between p-6 pointer-events-none transition-opacity duration-500 ${isControlsVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: isControlsVisible ? 'linear-gradient(to top, rgba(0,0,0,0.7), transparent 40%, transparent 60%, rgba(0,0,0,0.5))' : 'none' }}
      >
          <div className="flex justify-between items-start">
              <h2 className="text-white font-medium text-sm drop-shadow-md opacity-80 tracking-wide">{videoTitle}</h2>
          </div>
          
          {/* Big center play button - purely visual, click passes through to layer 30 */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              {!isPlaying && (
                  <div className="text-white drop-shadow-xl opacity-80 scale-125">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-16 h-16 ml-1">
                          <path d="M8 5v14l11-7z" />
                      </svg>
                  </div>
              )}
          </div>
          
          <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto pointer-events-auto pb-6">
              <div className="flex items-center gap-4 group/seek">
                  <span className="text-white/80 text-xs font-mono w-10 text-right">{formatTime(progress)}</span>
                  <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={progress}
                      onChange={handleSeek}
                      className="flex-grow h-1 bg-white/30 rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
                  />
                  <span className="text-white/80 text-xs font-mono w-10">{formatTime(duration)}</span>
              </div>
          </div>
      </div>
    </div>
  );
};

export default UniversalPlayer;