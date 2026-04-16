import React, { useEffect, useState, useRef } from 'react';
import { Slide } from '../types';
import ScalableSlide from '../components/Shared/ScalableSlide';

const StageDisplay: React.FC = () => {
    // --- BACKGROUND BUFFER (CROSS-FADE) ---
    // We keep this purely for background transitions
    const [bgBuffer, setBgBuffer] = useState<{
        id: number;
        slide: Slide | null;
        opacity: number;
        duration: number;
        zIndex: number;
    }[]>([]);

    // --- TEXT STATE (SEQUENTIAL FADE) ---
    // User Requirement: "Exit Before Enter"
    // 1. Fade Out (200ms) -> 2. Switch Content -> 3. Fade In (200ms)
    const [textSlide, setTextSlide] = useState<Slide | null>(null);
    const [isTextVisible, setIsTextVisible] = useState(false);
    const textTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- DECOUPLED STATE ---
    const currentBgTimestamp = useRef<number>(0);

    // --- EFFECT 0: REQUEST HANDSHAKE ON MOUNT ---
    useEffect(() => {
        if (window.electronAPI?.requestCurrentState) {
            window.electronAPI.requestCurrentState();
        }
    }, []);

    // --- EFFECT 1: MASTER LISTENER ---
    // Listens to ALL updates but dispatches to sub-logic based on change detection
    useEffect(() => {
        if (!window.electronAPI) return;

        const handleUpdate = (newSlide: Slide | null) => {
            // --- 1. MEDIA UPDATE LOGIC (Dependent on Timestamp/Visuals) ---
            const newTimestamp = newSlide?.backgroundTimestamp || 0;
            const newMediaUrl = newSlide?.backgroundMedia;

            setBgBuffer(prev => {
                const currentTop = prev[prev.length - 1];

                // CRITICAL CHECK: Has the timestamp changed? OR has the URL changed?
                // If timestamp matches current top, IGNORE (it's a text-only update or stale)
                // Exception: Initial load (prev empty)
                const isTimestampNew = newTimestamp > currentBgTimestamp.current;
                const isUrlDifferent = newMediaUrl !== currentTop?.slide?.backgroundMedia;

                // If neither changed, do NOT touch the background buffer
                // EXCEPTION: If buffer is empty (First Shot), we MUST accept it if there's a URL
                const isFirstShot = prev.length === 0 && !!newMediaUrl;

                if (!isTimestampNew && !isUrlDifferent && !isFirstShot && prev.length > 0) {
                    return prev;
                }

                // If cleared
                if (!newMediaUrl && prev.length > 0 && !prev[prev.length - 1].slide?.backgroundMedia) {
                    return prev;
                }

                // Update Local Timestamp Tracker
                if (newTimestamp > 0) currentBgTimestamp.current = newTimestamp;

                // --- SMART BUFFER LOGIC (Anti-Flicker) ---
                // 1. Soft Update: Same Media Source, Different Props (e.g. Scaling)
                // We reuse the OLD item's ID so React recycles the component instance (no unmount).
                const isSoftUpdate = currentTop &&
                    currentTop.slide?.backgroundMedia === newMediaUrl &&
                    currentTop.slide?.backgroundMediaType === newSlide?.backgroundMediaType;

                if (isSoftUpdate) {
                    // Clone buffer to mutate top item safely
                    const nextBuffer = [...prev];
                    const updatedItem = {
                        ...currentTop,
                        slide: newSlide, // New props
                        // KEEP SAME ID -> STABLE KEY -> NO UNMOUNT
                    };
                    nextBuffer[prev.length - 1] = updatedItem;
                    return nextBuffer;
                }

                // 2. Hard Transition: Different Media Source
                // New ID -> New Component -> Cross-fade
                let duration = 240; // 300ms reduced by 20%
                if (newMediaUrl !== currentTop?.slide?.backgroundMedia) duration = 640; // 800ms reduced by 20%

                const newItem = {
                    id: Date.now(),
                    slide: newSlide,
                    opacity: 0,
                    duration,
                    zIndex: (currentTop?.zIndex || 0) + 1
                };

                let nextBuffer = [...prev, newItem];
                if (nextBuffer.length > 3) nextBuffer = nextBuffer.slice(nextBuffer.length - 3);
                return nextBuffer;
            });

            // Trigger Fade-in for new BG item
            requestAnimationFrame(() => {
                setBgBuffer(prev => {
                    const lastIdx = prev.length - 1;
                    if (lastIdx < 0) return prev;
                    if (prev[lastIdx].opacity === 0) {
                        const newBuffer = [...prev];
                        newBuffer[lastIdx] = { ...newBuffer[lastIdx], opacity: 1 };
                        return newBuffer;
                    }
                    return prev;
                });
            });

            // --- 2. TEXT UPDATE LOGIC (Dependent on Content) ---
            setTextSlide(currentText => {
                // Check visual differences for TEXT only
                const hasContentChanged = (newSlide?.content !== currentText?.content);
                const hasFontChanged = (
                    newSlide?.fontFamily !== currentText?.fontFamily ||
                    newSlide?.fontSize !== currentText?.fontSize
                );
                const isClear = !newSlide?.content;

                // Optimization: If text is visually identical, do not trigger fade-out/in
                if (!hasContentChanged && !hasFontChanged && !isClear) {
                    // Update object but keep same visual state
                    return newSlide;
                }

                if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);

                // Step 1: Fade Out
                setIsTextVisible(false);

                // Step 2: Swap & Fade In
                textTimeoutRef.current = setTimeout(() => {
                    setTextSlide(newSlide);
                    // Fade In only if we have content
                    if (!isClear) {
                        requestAnimationFrame(() => setIsTextVisible(true));
                    }
                }, 200); // 200ms exit time

                return currentText; // Keep showing old text during fade out
            });
        };

        const cleanup = window.electronAPI.onUpdateStage(handleUpdate);
        return () => {
            if (cleanup) cleanup();
        };
    }, []); // Empty dependency! Use function form setter inside to prevent closure lock!

    // Cleanup Effect: Remove old Background layers once covered
    useEffect(() => {
        if (bgBuffer.length <= 1) return;

        const topItem = bgBuffer[bgBuffer.length - 1];
        // Only clean up if top item is fully visible
        if (topItem.opacity === 1) {
            const timer = setTimeout(() => {
                setBgBuffer(prev => {
                    if (prev.length <= 1) return prev;
                    return [prev[prev.length - 1]];
                });
            }, topItem.duration + 50);
            return () => clearTimeout(timer);
        }
    }, [bgBuffer]);

    return (
        <div className="w-screen h-screen relative flex items-center justify-center overflow-hidden bg-black">
            {/* BACKGROUND LAYER STACK */}
            {bgBuffer.map((item) => (
                <div
                    key={item.id}
                    className="absolute inset-0 w-full h-full"
                    style={{
                        zIndex: item.zIndex,
                        opacity: item.opacity,
                        transition: `opacity ${item.duration}ms ease-in-out`,
                        backgroundColor: item.slide?.backgroundMedia ? 'transparent' : 'black'
                    }}
                >
                    {/* Render ONLY Background */}
                    <ScalableSlide slide={item.slide} showText={false} showBackground={true} />
                </div>
            ))}

            {/* TEXT LAYER (Top Z-Index) */}
            <div
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                    zIndex: 9999, // Ensure text is always on top
                    opacity: isTextVisible ? 1 : 0,
                    transition: 'opacity 200ms ease-in-out'
                }}
            >
                {/* Render ONLY Text */}
                {/* We pass a valid slide object. If textSlide is null, ScalableSlide renders black, 
                     but we check isTextVisible. Also ScalableSlide handles null gracefully. */}
                <ScalableSlide slide={textSlide} showText={true} showBackground={false} />
            </div>
        </div>
    );
};

export default StageDisplay;
