import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VimeoPlayerProps, VimeoEmbedParams } from '../types';
import { VIMEO_PARAMS, VIDEO_CONFIG } from '../constants';

const VimeoPlayer: React.FC<VimeoPlayerProps> = ({ videoId, className = '' }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [videoTitle, setVideoTitle] = useState(VIDEO_CONFIG.title); // Initialize with default, update dynamically
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9); // Default to 16:9

  // Sizing State for "Cover" effect
  const [iframeStyle, setIframeStyle] = useState<React.CSSProperties>({
    width: '100%',
    height: '100%',
    opacity: 0, // Start invisible to avoid letterbox flash
    backgroundColor: '#000000', // Ensure black background
    transition: 'opacity 0.5s ease-in',
  });

  // Calculate dimensions to make iframe cover the screen (remove black/white bars)
  const handleResize = useCallback(() => {
    // If container not ready yet, use window dims directly
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const windowAspect = vw / vh;

    let width, height;

    if (windowAspect > videoAspectRatio) {
      // Window is wider than video -> Fit width, crop top/bottom
      width = vw;
      height = vw / videoAspectRatio;
    } else {
      // Window is taller than video -> Fit height, crop left/right
      height = vh;
      width = vh * videoAspectRatio;
    }

    setIframeStyle(prev => ({
      ...prev,
      width: `${width}px`,
      height: `${height}px`,
      position: 'absolute',
      top: '50%',
      left: '50%',
      // We scale by 1.01 to ensure a slight bleed over edges, preventing any single-pixel whitespace lines
      transform: 'translate(-50%, -50%) scale(1.01)', 
      opacity: 1, // Fade in once calculated
      backgroundColor: '#000000',
    }));
  }, [videoAspectRatio]);

  // Run resize immediately on mount and when aspect ratio changes
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    // Listen to visualViewport resize if available (handles mobile browser bars showing/hiding)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
    }
    
    return () => {
        window.removeEventListener('resize', handleResize);
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', handleResize);
        }
    };
  }, [handleResize]);

  // Initialize Player
  useEffect(() => {
    if (!iframeRef.current || !window.Vimeo) return;

    const player = new window.Vimeo.Player(iframeRef.current);
    playerRef.current = player;

    player.ready().then(() => {
      // fetch actual video dimensions to ensure perfect cover
      Promise.all([player.getVideoWidth(), player.getVideoHeight()])
        .then(([w, h]) => {
          if (w && h) {
            setVideoAspectRatio(w / h);
          }
        })
        .catch(console.error);
        
      // Fetch dynamic title
      player.getVideoTitle().then((title: string) => {
          if (title) setVideoTitle(title);
      }).catch(() => {});

      // Attempt initial unmute (often blocked by browser, but worth trying)
      player.setMuted(false).then(() => {
        setIsMuted(false);
        setVolume(1);
      }).catch(() => {
        // If blocked, we stay muted until interaction
        console.log('Autoplay with sound blocked, waiting for interaction');
      });
      
      player.getDuration().then((d: number) => setDuration(d));
      
      // Force play
      player.play().catch(console.error);
    });

    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('timeupdate', (data: any) => setProgress(data.seconds));
    player.on('volumechange', (data: any) => {
        setVolume(data.volume);
        setIsMuted(data.volume === 0);
    });
    
    // Ensure volume is up internally
    player.setVolume(1).catch(() => {});

    return () => {
      player.unload();
    };
  }, []);

  // Controls Visibility Logic
  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleInteraction = () => {
    showControlsTemporarily();
    
    // Aggressive unmute on any interaction
    if (playerRef.current) {
        // If muted, unmute
        if (isMuted) {
             playerRef.current.setMuted(false).then(() => {
                setIsMuted(false);
                setVolume(1);
            }).catch(() => {});
        }
        // Always try to force volume to 100% on interaction
        playerRef.current.setVolume(1).catch(() => {});
    }
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      // Ensure sound is on when we hit play
      playerRef.current.setMuted(false).catch(() => {});
      playerRef.current.setVolume(1).catch(() => {});
      playerRef.current.play();
    }
    showControlsTemporarily();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    playerRef.current?.setCurrentTime(time);
    showControlsTemporarily();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    playerRef.current?.setVolume(newVol);
    playerRef.current?.setMuted(newVol === 0);
    showControlsTemporarily();
  };

  const toggleMute = () => {
    if (isMuted) {
        playerRef.current?.setMuted(false);
        playerRef.current?.setVolume(1);
        setIsMuted(false);
        setVolume(1);
    } else {
        playerRef.current?.setMuted(true);
        setIsMuted(true);
        setVolume(0);
    }
    showControlsTemporarily();
  }

  // Generate Src
  const src = React.useMemo(() => {
    const params: VimeoEmbedParams = {
      ...VIMEO_PARAMS,
      player_id: '0',
      app_id: VIDEO_CONFIG.appId,
      controls: '0',
      background: '1', // Attempt to trigger background mode to help with filling
      transparent: '0', // Force opaque
    };
    const queryString = new URLSearchParams(params).toString();
    return `https://player.vimeo.com/video/${videoId}?${queryString}`;
  }, [videoId]);

  // Format time helper
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden bg-black group ${className}`}
        onClick={handleInteraction}
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
        style={{ backgroundColor: '#000000' }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        style={iframeStyle}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
        title={videoTitle}
        className="pointer-events-none bg-black"
      />

      {/* Controls Overlay */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 flex flex-col justify-between p-6 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Top Bar */}
        <div className="flex justify-between items-start pointer-events-auto">
            <h2 className="text-white font-medium text-sm drop-shadow-md opacity-80">{videoTitle}</h2>
            {isMuted && (
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L21 12m0 0l-3.75 2.25M21 12H3" />
                    </svg>
                    Tap to Unmute
                </button>
            )}
        </div>

        {/* Center Play Button */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
             {!isPlaying && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-110 transition-transform text-white border border-white/20"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" className="w-8 h-8 ml-1">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                 </button>
             )}
        </div>

        {/* Bottom Bar: Play Controls */}
        <div className="flex flex-col gap-2 w-full max-w-2xl mx-auto pointer-events-auto">
            
            {/* Seek Bar */}
            <div className="flex items-center gap-3">
                <span className="text-white/80 text-xs font-mono w-10 text-right">{formatTime(progress)}</span>
                <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={progress}
                    onChange={handleSeek}
                    className="flex-grow h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
                <span className="text-white/80 text-xs font-mono w-10">{formatTime(duration)}</span>
            </div>

            {/* Bottom Row: Play/Pause and Volume */}
            <div className="flex items-center justify-between mt-2">
                <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-gray-300 p-2">
                    {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>
                    )}
                </button>

                <div className="flex items-center gap-2 w-32">
                    <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white">
                         {isMuted || volume === 0 ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 21 12m0 0-3.75 2.25M21 12H3" />
                            </svg>
                         ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                            </svg>
                         )}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="flex-grow h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VimeoPlayer;