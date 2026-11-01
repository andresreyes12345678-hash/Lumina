import { useState, useRef, useEffect, useCallback } from 'react';
import { Slide } from '../types';

export interface TransitionConfig {
    type: 'fade' | 'slide' | 'zoom';
    speed: number;
}

/**
 * useTextTransition — Hook que encapsula la lógica de transición "Exit Before Enter".
 *
 * Secuencia:
 * 1. Detecta cambio de contenido o fuente en el slide entrante.
 * 2. Fade Out (transitionConfig.speed ms).
 * 3. Swapea el contenido internamente.
 * 4. Fade In en el siguiente frame.
 *
 * Usado por: StageDisplay, LivePreview, NdiView
 */
export function useTextTransition(defaultSpeed = 200) {
    const [textSlide, setTextSlide] = useState<Slide | null>(null);
    const [isTextVisible, setIsTextVisible] = useState(false);
    const [transitionConfig, setTransitionConfig] = useState<TransitionConfig>({ type: 'fade', speed: defaultSpeed });
    const textTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
        };
    }, []);

    const updateText = useCallback((newSlide: Slide | null) => {
        const transType = (newSlide?.transitionType || 'fade') as TransitionConfig['type'];
        const transSpeed = newSlide?.transitionSpeed || defaultSpeed;
        setTransitionConfig({ type: transType, speed: transSpeed });

        setTextSlide(currentText => {
            const hasContentChanged = newSlide?.content !== currentText?.content;
            const hasFontChanged =
                newSlide?.fontFamily !== currentText?.fontFamily ||
                newSlide?.fontSize !== currentText?.fontSize;
            const isClear = !newSlide?.content;

            if (!hasContentChanged && !hasFontChanged && !isClear) {
                return newSlide;
            }

            if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);

            setIsTextVisible(false);

            textTimeoutRef.current = setTimeout(() => {
                setTextSlide(newSlide);
                if (!isClear) {
                    requestAnimationFrame(() => setIsTextVisible(true));
                }
            }, transSpeed);

            return currentText;
        });
    }, [defaultSpeed]);

    return {
        textSlide,
        isTextVisible,
        transitionConfig,
        updateText
    };
}
