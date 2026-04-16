import React, { useEffect, useState, useRef } from 'react';
import { Slide } from '../types';
import ScalableSlide from '../components/Shared/ScalableSlide';

const NdiView: React.FC = () => {
    const [textSlide, setTextSlide] = useState<Slide | null>(null);
    const [isTextVisible, setIsTextVisible] = useState(false);
    
    // To minimize CPU usage, NDI should only capture when the screen is actually changing.
    // The main process will respond to these events.
    const notifyMainProcess = (isAnimating: boolean) => {
        if (window.electronAPI && (window.electronAPI as any).notifyNdiAnimation) {
            (window.electronAPI as any).notifyNdiAnimation(isAnimating);
        }
    };

    useEffect(() => {
        if (!window.electronAPI) return;

        const handleUpdate = (newSlide: Slide | null) => {
            setTextSlide(currentText => {
                const hasContentChanged = (newSlide?.content !== currentText?.content);
                const hasFontChanged = (
                    newSlide?.fontFamily !== currentText?.fontFamily ||
                    newSlide?.fontSize !== currentText?.fontSize
                );
                const isClear = !newSlide?.content;

                if (!hasContentChanged && !hasFontChanged && !isClear) {
                    return newSlide; // Visually identical
                }

                // 1. We are about to start a transition! Tell main process to start capturing frames.
                notifyMainProcess(true);
                setIsTextVisible(false);

                // 2. Swap & Fade In
                setTimeout(() => {
                    setTextSlide(newSlide);
                    if (!isClear) {
                        requestAnimationFrame(() => setIsTextVisible(true));
                    }
                    
                    // Stop capturing 400ms after the fade in finishes to allow the transition to complete
                    setTimeout(() => {
                        notifyMainProcess(false);
                    }, 400); 

                }, 200);

                return currentText;
            });
        };

        window.electronAPI.onUpdateStage(handleUpdate);
    }, []);

    // Ensure body is transparent (though it should be via HTML/CSS already)
    useEffect(() => {
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
    }, []);

    return (
        <div className="w-screen h-screen relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'transparent' }}>
            {/* TEXT LAYER */}
            <div
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                    zIndex: 9999,
                    opacity: isTextVisible ? 1 : 0,
                    transition: 'opacity 200ms ease-in-out',
                    backgroundColor: 'transparent'
                }}
            >
                {/* Render ONLY Text. We do not want the scalable slide to render a background. */}
                <ScalableSlide slide={textSlide} showText={true} showBackground={false} />
            </div>
        </div>
    );
};

export default NdiView;
