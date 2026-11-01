import React, { useLayoutEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Slide } from '../../types';
import VideoEngine from './VideoEngine';

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
    control?: any; // Explicit control override
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
    muted = false,
    control
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
                let parentWidth = containerRef.current.clientWidth;
                let parentHeight = containerRef.current.clientHeight;
                
                if (!parentWidth || !parentHeight) {
                    const rect = containerRef.current.getBoundingClientRect();
                    parentWidth = rect.width;
                    parentHeight = rect.height;
                }

                if (!parentWidth) parentWidth = window.innerWidth;
                if (!parentHeight) parentHeight = window.innerHeight;

                const scaleX = parentWidth / BASE_WIDTH;
                const scaleY = parentHeight / BASE_HEIGHT;
                const calculatedScale = Math.min(scaleX, scaleY);

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
                                control={control || slide.videoControl}
                                isLooping={control?.isLooping ?? slide.videoControl?.isLooping ?? slide.isLooping ?? false}
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
    const prevControl = prev.control || prev.slide?.videoControl;
    const nextControl = next.control || next.slide?.videoControl;

    if (prevControl !== nextControl) {
        if (prevControl?.isPlaying !== nextControl?.isPlaying) return false;
        if (prevControl?.isLooping !== nextControl?.isLooping) return false;
        if (prevControl?.seekTime !== nextControl?.seekTime) return false;
        if (prevControl?.seekTrigger !== nextControl?.seekTrigger) return false;
        // Volume change?
        if (prevControl?.volume !== nextControl?.volume) return false;
    }

    // If we passed all checks, props are "effectively equal" -> Skip Render
    return true;
};

export default React.memo(ScalableSlide, arePropsEqual);