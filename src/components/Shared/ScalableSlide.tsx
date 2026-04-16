import React, { useLayoutEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Slide } from '../../types';

interface ScalableSlideProps {
    slide: Slide | null;
    width?: number; // Optional: force a specific width
    height?: number; // Optional: force a specific height
    className?: string; // Optional: additional classes for the container
    onScaleReady?: () => void; // Callback when scale is calculated
    onPlaybackUpdate?: (state: { currentTime: number; duration: number; isPlaying: boolean }) => void; // Callback for live playback
    showBackground?: boolean;
    showText?: boolean;
    muted?: boolean;
}

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

const ScalableSlide: React.FC<ScalableSlideProps> = ({
    slide,
    className,
    onScaleReady,
    onPlaybackUpdate,
    showBackground = true,
    showText = true,
    muted = false
}) => {
    // ... existing layout effect ...
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);
    const [isReady, setIsReady] = useState(false);

    // Fade-out logic for backgrounds
    const [displayMedia, setDisplayMedia] = useState<string | undefined>(slide?.backgroundMedia);
    const [displayMediaType, setDisplayMediaType] = useState(slide?.backgroundMediaType);
    const [displayOpacity, setDisplayOpacity] = useState(slide?.backgroundMedia ? 1 : 0);
    const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        if (slide?.backgroundMedia) {
            // Active media exists
            setDisplayMedia(slide.backgroundMedia);
            setDisplayMediaType(slide.backgroundMediaType);
            setDisplayOpacity(1);
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        } else if (!slide?.backgroundMedia && displayMedia) {
            // Media was cleared, trigger fade out
            setDisplayOpacity(0);
            fadeTimerRef.current = setTimeout(() => {
                setDisplayMedia(undefined);
                setDisplayMediaType(undefined);
            }, 500); // 500ms fade out
        }
    }, [slide?.backgroundMedia, slide?.backgroundMediaType]);

    useLayoutEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
// ... existing layout effect ...
                let parentWidth = containerRef.current.clientWidth;
                if (!parentWidth) {
                    const rect = containerRef.current.getBoundingClientRect();
                    parentWidth = rect.width;
                }

                if (!parentWidth) {
                    parentWidth = window.innerWidth;
                }

                const calculatedScale = parentWidth / BASE_WIDTH;

                if (Number.isFinite(calculatedScale) && calculatedScale > 0) {
                    setScale(calculatedScale);
                }
            }
        };

        updateScale();
        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) observer.observe(containerRef.current);

        const timer = setTimeout(() => {
            updateScale();
            setIsReady(true);
            setScale(prev => prev === 0 ? 1 : prev);
        }, 100);

        return () => { observer.disconnect(); clearTimeout(timer); };
    }, [slide?.id, onScaleReady]);

    if (!slide) {
        return <div ref={containerRef} className={`w-full h-full ${className || ''}`} />;
    }

    const isVideo = displayMediaType === 'video' || (
        !displayMediaType && displayMedia && displayMedia.match(/\.(mp4|webm|ogg)$/i)
    );

    // --- SECURITY: Convert absolute paths to custom protocol ---
    const getSafeMediaUrl = (url?: string) => {
        if (!url) return undefined;
        if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('lumina-media://')) {
            return url;
        }
        // Purge legacy file:/// prefix if persisted in DB before applying proxy
        const cleanPath = url.replace('file:///', '');
        return `lumina-media://${cleanPath}`;
    };

    const safeDisplayMedia = getSafeMediaUrl(displayMedia);

    return (
        <div
            ref={containerRef}
            className={`w-full h-full relative overflow-hidden flex items-center justify-center ${className || ''}`}
            style={{
                opacity: isReady ? 1 : 0,
                transition: 'opacity 0.2s ease-out'
            }}
        >
            {/* Background Layer - Moved outside scaling grid to fill true native display bounds */}
            {showBackground && (
                <div 
                    className="absolute inset-0 transition-opacity duration-500 ease-out z-0" 
                    style={{ 
                        backgroundColor: slide.backgroundColor || 'transparent',
                        opacity: displayOpacity
                    }}
                >
                    {safeDisplayMedia && (
                        isVideo ? (
                            <VideoEngine
                                src={safeDisplayMedia}
                                scaling={slide.backgroundScaling}
                                control={slide.videoControl}
                                isLooping={slide.videoControl?.isLooping ?? slide.isLooping ?? false}
                                onPlaybackUpdate={onPlaybackUpdate}
                                muted={muted}
                            />
                        ) : (
                            <img
                                className="w-full h-full"
                                style={{ objectFit: slide.backgroundScaling === 'fill' ? 'fill' : 'contain' }}
                                src={safeDisplayMedia}
                                alt="Background"
                            />
                        )
                    )}
                </div>
            )}

            <div
                className="origin-center z-10"
                style={{
                    width: BASE_WIDTH,
                    height: BASE_HEIGHT,
                    transform: `scale(${scale})`,
                    flexShrink: 0
                }}
            >

                {/* Text Layer */}
                {showText && (
                    <div className="absolute inset-0 flex items-center justify-center p-20 z-10">
                        {slide.type === 'bible' ? (
                            <div className="w-full h-full flex items-center justify-center relative">
                                <p
                                    className="text-white text-center font-bold leading-tight whitespace-pre-wrap"
                                    style={{
                                        fontFamily: slide.fontFamily || 'Open Sans',
                                        fontSize: `${slide.fontSize || 64}px`,
                                        textShadow: 'rgba(0, 0, 0, 0.4) 0px 4px 12px'
                                    }}
                                    dangerouslySetInnerHTML={{ 
                                        __html: DOMPurify.sanitize(slide.content.split('\n\n').slice(1).join('\n\n') || slide.content) 
                                    }}
                                />
                                <div 
                                    className="absolute font-semibold text-white/80 tracking-wide"
                                    style={{
                                        bottom: '2%',
                                        right: '2%',
                                        fontSize: `${(slide.fontSize || 64) * 0.9}px`,
                                        textShadow: 'rgba(0, 0, 0, 0.5) 0px 2px 8px'
                                    }}
                                    dangerouslySetInnerHTML={{ 
                                        __html: DOMPurify.sanitize(slide.content.split('\n\n')[0]) 
                                    }}
                                />
                            </div>
                        ) : (
                            <p
                                className="text-white text-center font-bold leading-tight whitespace-pre-wrap"
                                style={{
                                    fontFamily: slide.fontFamily || 'Open Sans',
                                    fontSize: `${slide.fontSize || 64}px`,
                                    textShadow: 'none'
                                }}
                                dangerouslySetInnerHTML={{ 
                                    __html: DOMPurify.sanitize(slide.content) 
                                }}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- VIDEO ENGINE COMPONENT ---
interface VideoEngineProps {
    src: string;
    scaling?: 'contain' | 'cover' | 'fill';
    isLooping?: boolean;
    control?: {
        isPlaying: boolean;
        volume: number;
        seekTime?: number;
    };
    onPlaybackUpdate?: (state: { currentTime: number; duration: number; isPlaying: boolean }) => void;
    muted?: boolean;
}

const VideoEngine: React.FC<VideoEngineProps> = ({ src, scaling, control, isLooping, onPlaybackUpdate, muted = false }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [hasError, setHasError] = useState(false);
    const isMounted = useRef(true);
    const loadIdRef = useRef(0); // Track load attempts
    const isLoopingRef = useRef(isLooping); // Track latest loop state without triggering video reload

    // Internal refs to track control state to avoid redundant calls
    const lastSeekRef = useRef<number | undefined>(undefined);

    // Keep the looping ref in sync with props, and update native video.loop attribute
    React.useEffect(() => {
        isLoopingRef.current = isLooping;
        if (videoRef.current) {
            videoRef.current.loop = !!isLooping;
        }
    }, [isLooping]);

    // Initial Load
    React.useEffect(() => {
        isMounted.current = true;
        const video = videoRef.current;
        if (!video) return;

        // Reset state
        setIsVisible(false);
        setIsFadingOut(false);
        setHasError(false);

        // Increment load ID to invalidate previous attempts
        const currentLoadId = ++loadIdRef.current;

        const loadVideo = async () => {
            return new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    if (isMounted.current && currentLoadId === loadIdRef.current) {
                        reject(new Error('Video load timeout (5s)'));
                    }
                }, 5000);

                const onReady = () => {
                    clearTimeout(timeout);
                    // Check for invalid dimensions (Unsupported Codec)
                    if (video.videoWidth === 0 || video.videoHeight === 0) {
                        reject(new Error(`Invalid Dimensions: ${video.videoWidth}x${video.videoHeight}`));
                        return;
                    }
                    resolve();
                };

                const onError = (e: Event) => {
                    clearTimeout(timeout);
                    const videoEl = e.target as HTMLVideoElement;
                    const err = videoEl.error;
                    console.error('[VideoEngine] Load Error:', err, 'Src:', src);
                    if (err) {
                        console.error(`Code: ${err.code}, Message: ${err.message}`);
                    }
                    reject(err || new Error('Unknown video error'));
                };

                video.addEventListener('canplaythrough', onReady, { once: true });
                video.addEventListener('error', onError, { once: true });

                video.src = src;
                video.load();
            });
        };

        loadVideo()
            .then(async () => {
                if (!isMounted.current || currentLoadId !== loadIdRef.current) {
                    return;
                }

                // --- DOUBLE-TAP SOFT-START (Anti Metal-Audio Glitch) ---
                const originalMuted = muted; 
                video.muted = true;          // Force silence for pre-warm
                if ('preservesPitch' in video) {
                    (video as any).preservesPitch = false; // Prevents generic pitch correction artifacts
                }

                try {
                    await video.play();
                    await new Promise(res => setTimeout(res, 300)); // Play 300ms
                    video.load();            // Force destroy and rebuild the audio node
                } catch {
                    // Ignore interruption errors during pre-warm
                }
                
                video.muted = originalMuted; // Restore original intent
                // --- End Double-Tap ---

                // If control says playing, play.
                if (!control || control.isPlaying) {
                    try {
                        await video.play();
                    } catch {
                        // Ignore "interrupted" errors caused by rapid switching
                        // Silent failure for interruption
                    }
                }

                if (isMounted.current && currentLoadId === loadIdRef.current) {
                    setIsVisible(true);
                }
            })
            .catch(() => {
                if (isMounted.current && currentLoadId === loadIdRef.current) {
                    setHasError(true);
                }
            });

        // Setup Time Update Listener
        const handleTimeUpdate = () => {
            if (onPlaybackUpdate && video) {
                onPlaybackUpdate({
                    currentTime: video.currentTime,
                    duration: video.duration,
                    isPlaying: !video.paused
                });
            }
        };

        // Loop Logic (reads from ref to avoid stale closures)
        const handleEnded = () => {
            if (isLoopingRef.current || video.loop) {
                video.currentTime = 0;
                video.play().catch(() => { });
            } else {
                setIsFadingOut(true);
                // Notify system that video ended (to trigger auto-clear)
                // GUARD: Only send from StageDisplay (which has no onPlaybackUpdate)
                // to prevent the LivePreview from racing and killing the media layer
                if (!onPlaybackUpdate) {
                    window.electronAPI.sendVideoEnded?.();
                }
            }
        };

        const handlePlay = () => {
            if (isFadingOut) setIsFadingOut(false);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('play', handlePlay);

        return () => {
            isMounted.current = false;
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('play', handlePlay);

            // Stop playback on unmount to prevent ghost audio
            video.pause();
            video.removeAttribute('src'); // Cleaner than src=""
            video.load();
        };
    }, [src]); // Only reload on source change. Loop state is handled via ref + separate effect.

    // React to Control Props (Legacy/Props-based control fallback)
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video || !control) return;

        // Play/Pause
        if (control.isPlaying && video.paused) {
            video.play().catch(() => {
                // Silent catch
            });
        } else if (!control.isPlaying && !video.paused) {
            video.pause();
        }

        // Seek
        if (control.seekTime !== undefined && control.seekTime !== lastSeekRef.current && control.seekTime !== 0) {
            if (Math.abs(video.currentTime - control.seekTime) > 0.5) {
                video.currentTime = control.seekTime;
                lastSeekRef.current = control.seekTime;
                setIsFadingOut(false);
            }
        }
    }, [control]);

    // IPC Control Listener (New)
    React.useEffect(() => {
        if (!window.electronAPI?.onVideoControl) return;

        const cleanup = window.electronAPI.onVideoControl((data) => {
            const video = videoRef.current;
            if (!video) return;

            if (data.action === 'play') {
                video.play().catch(() => { });
            } else if (data.action === 'pause') {
                video.pause();
            } else if (data.action === 'seek' && data.time !== undefined) {
                video.currentTime = data.time;
                setIsFadingOut(false);
            } else if (data.action === 'loop' && data.value !== undefined) {
                video.loop = data.value;
                isLoopingRef.current = data.value; // Keep ref in sync with IPC commands
            }
        });

        return cleanup;
    }, []);

    if (hasError) {
        return (
            <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <p className="text-xl font-bold mb-2 text-red-400">Error de Video</p>
                <p className="text-sm">No se pudo reproducir este archivo.</p>
                <p className="text-xs opacity-75 mt-1">Formato incompatible o archivo corrupto.</p>
            </div>
        );
    }

    return (
        <video
            ref={videoRef}
            className="w-full h-full"
            style={{
                objectFit: scaling === 'fill' ? 'fill' : 'contain',
                opacity: (isVisible && !isFadingOut) ? 1 : 0,
                transition: isFadingOut ? 'opacity 1.2s ease-out' : 'opacity 0.5s ease-in',
                // GPU RENDERING OPTIMIZATIONS (Broadcast Quality)
                transform: 'translateZ(0)',        // Force GPU layer
                backfaceVisibility: 'hidden',      // Optimize 3D transforms
                willChange: 'transform, opacity'   // Hint browser for optimization
            } as React.CSSProperties}
            // @ts-ignore
            preservesPitch={false}
            muted={muted}
            loop={isLooping}
            playsInline
        />
    );
};

// --- COMPARISON FUNCTION FOR MEMOIZATION ---
const arePropsEqual = (prev: ScalableSlideProps, next: ScalableSlideProps) => {
    // 1. If slide existence changes, re-render
    if (!prev.slide && !next.slide) return true;
    if (!prev.slide || !next.slide) return false;

    // 2. Check Critical Visual Properties
    // If these change, we MUST re-render
    if (prev.slide.id !== next.slide.id) return false;
    if (prev.slide.content !== next.slide.content) return false;
    if (prev.slide.backgroundMedia !== next.slide.backgroundMedia) return false;
    if (prev.slide.backgroundScaling !== next.slide.backgroundScaling) return false;
    if (prev.slide.backgroundMediaType !== next.slide.backgroundMediaType) return false;
    if (prev.slide.fontFamily !== next.slide.fontFamily) return false;
    if (prev.slide.fontSize !== next.slide.fontSize) return false;
    // Check timestamp for forced updates (decoupling)
    if (prev.slide.backgroundTimestamp !== next.slide.backgroundTimestamp) return false;

    // 3. Check Dimensions/Classes
    if (prev.width !== next.width) return false;
    if (prev.height !== next.height) return false;
    if (prev.className !== next.className) return false;

    // 4. Check Visibility Flags
    if (prev.showBackground !== next.showBackground) return false;
    if (prev.showText !== next.showText) return false;

    // 5. Video Control Checks (Deep check to avoid unnecessary renders on playback ticks)
    // Only re-render if control state ACTUALLY changes in a meaningful way
    const prevControl = prev.slide.videoControl;
    const nextControl = next.slide.videoControl;

    if (prevControl !== nextControl) {
        if (prevControl?.isPlaying !== nextControl?.isPlaying) return false;
        if (prevControl?.isLooping !== nextControl?.isLooping) return false;
        if (prevControl?.seekTime !== nextControl?.seekTime) return false;
        // Volume change?
        if (prevControl?.volume !== nextControl?.volume) return false;
    }

    // If we passed all checks, props are "effectively equal" -> Skip Render
    return true;
};

export default React.memo(ScalableSlide, arePropsEqual);
