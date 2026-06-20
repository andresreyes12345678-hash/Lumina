import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { HOTKEY_MAP, SlideType } from '../types';

export const useHotkeys = () => {
    const {
        nextSlide,
        previousSlide,
        setActiveSlide,
        slides: directSlides,
        songs,
        selectedSongId
    } = useStore();

    const slides = selectedSongId
        ? songs.find(s => s.id === selectedSongId)?.slides || []
        : directSlides;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();

            // Ignore if typing in an input/textarea
            const target = event.target as HTMLElement;
            const tagName = target?.tagName?.toUpperCase();
            if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) {
                return;
            }

            // Navigation keys
            if (key === 'arrowright') {
                event.preventDefault();
                nextSlide();
                return;
            }

            if (key === 'arrowleft') {
                event.preventDefault();
                previousSlide();
                return;
            }

            if (key === 'backspace') {
                event.preventDefault();
                // Blackout
                if (window.electronAPI) {
                    window.electronAPI.blackout();
                }
                setActiveSlide(null);
                return;
            }

            // Type-specific hotkeys
            if (key in HOTKEY_MAP) {
                event.preventDefault();
                const slideType = HOTKEY_MAP[key] as SlideType;

                // Find first slide with this type
                const targetSlide = slides.find(slide => slide.type === slideType);

                if (targetSlide) {
                    const index = slides.findIndex(s => s.id === targetSlide.id);
                    setActiveSlide(targetSlide, index);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [nextSlide, previousSlide, setActiveSlide, slides, directSlides, songs, selectedSongId]);
};
