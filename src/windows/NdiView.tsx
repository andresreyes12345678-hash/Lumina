import React, { useEffect } from 'react';
import { Slide } from '../types';
import ScalableSlide from '../components/Shared/ScalableSlide';
import { useTextTransition } from '../hooks/useTextTransition';

const NdiView: React.FC = () => {
    const { textSlide, isTextVisible, updateText } = useTextTransition();
    
    // Notifica al proceso principal si hay animaciones en curso para optimizar captura NDI
    const notifyMainProcess = (isAnimating: boolean) => {
        if (window.electronAPI && (window.electronAPI as any).notifyNdiAnimation) {
            (window.electronAPI as any).notifyNdiAnimation(isAnimating);
        }
    };

    useEffect(() => {
        if (!window.electronAPI) return;

        const handleUpdate = (newSlide: Slide | null) => {
            // Avisa al Main Process que empieza una transición (captura NDI)
            notifyMainProcess(true);

            updateText(newSlide);

            // Para captura NDI: detener 400ms después del fade-in
            const speed = newSlide?.transitionSpeed || 200;
            setTimeout(() => notifyMainProcess(false), speed + 400);
        };

        window.electronAPI.onUpdateStage(handleUpdate);
    }, [updateText]);

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
