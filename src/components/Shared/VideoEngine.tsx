import React, { useRef, useState } from 'react';

// --- VIDEO ENGINE COMPONENT ---
// Extraído de ScalableSlide.tsx sin cambios de lógica (reproductor de video con fade, loop, volumen y control IPC).

interface VideoEngineProps {
    src: string;
    scaling?: 'contain' | 'cover' | 'fill';
    isLooping?: boolean;
    control?: {
        isPlaying: boolean;
        volume: number;
        seekTime?: number;
        seekTrigger?: number;
    };
    onPlaybackUpdate?: (state: { currentTime: number; duration: number; isPlaying: boolean }) => void;
    muted?: boolean;
    volume?: number; // 0.0 to 1.0 — explicit volume control (overrides control.volume)
}

const VideoEngine: React.FC<VideoEngineProps> = ({ src, scaling, control, isLooping, onPlaybackUpdate, muted = false, volume }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [hasError, setHasError] = useState(false);
    const isMounted = useRef(true);
    const loadIdRef = useRef(0); // Track load attempts to invalidate stale callbacks
    const isLoopingRef = useRef(isLooping); // Ref to avoid triggering video reload on loop change

    // Internal refs to track control state and avoid redundant calls
    const lastSeekTriggerRef = useRef<number | undefined>(undefined);

    // Keep the looping ref in sync with props, and update native video.loop attribute
    React.useEffect(() => {
        isLoopingRef.current = isLooping;
        if (videoRef.current) {
            videoRef.current.loop = !!isLooping;
        }
    }, [isLooping]);

    // Volume control effect — updates when volume prop or muted prop changes
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (muted) {
            video.muted = true;
        } else {
            video.muted = false;
            // Explicit volume prop takes priority, otherwise use control.volume, fallback to 0.8
            const targetVolume = volume ?? control?.volume ?? 0.8;
            video.volume = Math.max(0, Math.min(1, targetVolume));
        }
    }, [muted, volume, control?.volume]);

    // Initial Load — fires only when src changes
    React.useEffect(() => {
        isMounted.current = true;
        const video = videoRef.current;
        if (!video) return;

        // Reset visual state for new source
        setIsVisible(false);
        setIsFadingOut(false);
        setHasError(false);
        lastSeekTriggerRef.current = undefined;

        // Increment load ID to invalidate previous async attempts
        const currentLoadId = ++loadIdRef.current;

        const loadVideo = async () => {
            return new Promise<void>((resolve, reject) => {
                // 15s timeout — accommodates large files on slower storage
                const timeout = setTimeout(() => {
                    if (isMounted.current && currentLoadId === loadIdRef.current) {
                        reject(new Error('Video load timeout (15s)'));
                    }
                }, 15000);

                // Use 'loadeddata' instead of 'canplaythrough':
                // - canplaythrough waits until enough data is buffered for smooth playback (can be slow on large files)
                // - loadeddata fires as soon as the first frame is decoded and ready to display (much faster)
                const onReady = () => {
                    clearTimeout(timeout);
                    // Check for invalid dimensions (unsupported codec / decode failure)
                    if (video.videoWidth === 0 || video.videoHeight === 0) {
                        reject(new Error(`Invalid dimensions: ${video.videoWidth}x${video.videoHeight}`));
                        return;
                    }
                    resolve();
                };

                const onError = (e: Event) => {
                    clearTimeout(timeout);
                    const videoEl = e.target as HTMLVideoElement;
                    const err = videoEl.error;
                    console.error('[VideoEngine] Load error:', err, 'Src:', src);
                    if (err) console.error(`Code: ${err.code}, Message: ${err.message}`);
                    reject(err || new Error('Unknown video error'));
                };

                video.addEventListener('loadeddata', onReady, { once: true });
                video.addEventListener('error', onError, { once: true });

                video.src = src;
                video.load();
            });
        };

        loadVideo()
            .then(async () => {
                if (!isMounted.current || currentLoadId !== loadIdRef.current) return;

                // Apply initial volume before playing
                if (muted) {
                    video.muted = true;
                } else {
                    video.muted = false;
                    const targetVolume = volume ?? control?.volume ?? 0.8;
                    video.volume = Math.max(0, Math.min(1, targetVolume));
                }

                // Apply initial loop setting
                video.loop = !!isLoopingRef.current;

                // Start playback if control says so (or no control provided defaults to playing)
                if (!control || control.isPlaying) {
                    try {
                        await video.play();
                    } catch {
                        // Silent: 'interrupted' errors happen on rapid src switches, not an actual failure
                    }
                }

                if (isMounted.current && currentLoadId === loadIdRef.current) {
                    setIsVisible(true);
                }
            })
            .catch((err) => {
                if (isMounted.current && currentLoadId === loadIdRef.current) {
                    console.error('[VideoEngine] Failed to load video:', err);
                    setHasError(true);
                }
            });

        // Time update listener — throttled via rAF to avoid excessive store updates
        let rafId: number | null = null;
        const handleTimeUpdate = () => {
            if (!onPlaybackUpdate || !video) return;
            if (rafId !== null) return; // Already scheduled
            rafId = requestAnimationFrame(() => {
                rafId = null;
                if (onPlaybackUpdate && video) {
                    onPlaybackUpdate({
                        currentTime: video.currentTime,
                        duration: video.duration,
                        isPlaying: !video.paused
                    });
                }
            });
        };

        // Loop / End handler
        const handleEnded = () => {
            if (isLoopingRef.current || video.loop) {
                video.currentTime = 0;
                video.play().catch(() => {});
            } else {
                setIsFadingOut(true);
                // Only Stage (no onPlaybackUpdate) sends video-ended to avoid race conditions
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
            if (rafId !== null) cancelAnimationFrame(rafId);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('play', handlePlay);

            // Clean teardown: stop audio, release media reference
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
    }, [src]); // Only reload on source change; loop/volume handled via separate effects

    // React to Control Props (play/pause/seek from store)
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video || !control) return;

        // Play / Pause
        if (control.isPlaying && video.paused) {
            video.play().catch(() => {});
        } else if (!control.isPlaying && !video.paused) {
            video.pause();
        }

        // Seek
        if (control.seekTrigger !== undefined &&
            control.seekTrigger !== lastSeekTriggerRef.current) {
            video.currentTime = control.seekTime ?? 0;
            lastSeekTriggerRef.current = control.seekTrigger;
            setIsFadingOut(false);
        }
    }, [control]);

    // IPC Control Listener (Stage window receives commands from Control window)
    React.useEffect(() => {
        if (!window.electronAPI?.onVideoControl) return;

        const cleanup = window.electronAPI.onVideoControl((data) => {
            const video = videoRef.current;
            if (!video) return;

            if (data.action === 'play') {
                video.play().catch(() => {});
            } else if (data.action === 'pause') {
                video.pause();
            } else if (data.action === 'seek' && data.time !== undefined) {
                video.currentTime = data.time;
                setIsFadingOut(false);
            } else if (data.action === 'loop' && data.value !== undefined) {
                video.loop = data.value;
                isLoopingRef.current = data.value;
            }
        });

        return cleanup;
    }, []);

    // IPC Volume Listener (Stage window receives volume changes from Control window)
    React.useEffect(() => {
        if (!window.electronAPI?.onVideoVolume) return;

        const cleanup = window.electronAPI.onVideoVolume((data: { volume: number }) => {
            const video = videoRef.current;
            if (!video || video.muted) return;
            video.volume = Math.max(0, Math.min(1, data.volume));
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
                transition: isFadingOut ? 'opacity 1.2s ease-out' : 'opacity 0.4s ease-in',
                // GPU compositing layer — avoids repaints on opacity/transform changes
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
            } as React.CSSProperties}
            muted={muted}
            loop={isLooping}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
        />
    );
};

export default VideoEngine;
