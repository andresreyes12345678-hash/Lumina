import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Settings, CheckSquare, Layers } from 'lucide-react';

import VideoControls from './VideoControls';
import NdiToggle from './NdiToggle';

const FONT_FAMILIES = [
    'Open Sans',
    'Poppins',
    'Arial',
    'Roboto',
    'Georgia',
    'Times New Roman',
    'Courier New'
];

type EditScope = 'selection' | 'all';

const PropertiesPanel: React.FC = () => {
    const {
        activeSlide,
        updateSlide,
        selectedSlideIds,
        selectedSongId,
        songs,
        updateSong,
        slides: directSlides
    } = useStore();

    // START: Local State for Responsive UI
    const [localFontFamily, setLocalFontFamily] = useState<string>('Open Sans');
    const [localFontSize, setLocalFontSize] = useState<number>(64);

    // Edit Scope State
    const [editScope, setEditScope] = useState<EditScope>('all');

    // RESOLVE SLIDE FROM LIBRARY (Decouple from Live Snapshot)
    // Now also falls back to the FIRST slide of the selected song when no specific slide is selected
    const resolvedSlide = React.useMemo(() => {
        const targetId = selectedSlideIds.length > 0 ? selectedSlideIds[0] : activeSlide?.id;

        // 1. Try specific slide by ID
        if (targetId) {
            if (selectedSongId) {
                const song = songs.find(s => s.id === selectedSongId);
                const slide = song?.slides.find(s => s.id === targetId);
                if (slide) return slide;
            }

            const direct = directSlides.find(s => s.id === targetId);
            if (direct) return direct;

            if (activeSlide && activeSlide.id === targetId) return activeSlide;
        }

        // 2. FALLBACK: If a song is selected but no specific slide, use first slide as reference
        if (selectedSongId) {
            const song = songs.find(s => s.id === selectedSongId);
            if (song && song.slides.length > 0) return song.slides[0];
        }

        return null;
    }, [selectedSlideIds, activeSlide, selectedSongId, songs, directSlides]);

    // Get selected song for title editing
    const selectedSong = selectedSongId ? songs.find(s => s.id === selectedSongId) : null;

    // Sync Local State when Resolved Slide changes
    useEffect(() => {
        if (resolvedSlide) {
            setLocalFontFamily(resolvedSlide.fontFamily || 'Open Sans');
            setLocalFontSize(resolvedSlide.fontSize || 64);
        }
    }, [resolvedSlide]);

    // Auto-switch scope: default to 'all' when a song is selected, 'selection' for multi-select
    useEffect(() => {
        if (selectedSlideIds.length > 1) {
            setEditScope('selection');
        } else if (selectedSongId) {
            setEditScope('all');
        }
    }, [selectedSlideIds.length, selectedSongId]);

    // No slide and no song → empty state
    if (!resolvedSlide) {
        return (
            <div className="p-4 flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                    <Settings size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Selecciona una canción o diapositiva</p>
                </div>
            </div>
        );
    }

    // Determine if Active Slide is Video
    const isVideo = resolvedSlide.backgroundMediaType === 'video' || (
        !resolvedSlide.backgroundMediaType &&
        resolvedSlide.backgroundMedia &&
        resolvedSlide.backgroundMedia.match(/\.(mp4|webm|ogg)$/i)
    );

    const applyChange = (updates: any) => {
        if (editScope === 'selection') {
            const idsToUpdate = selectedSlideIds.length > 0
                ? selectedSlideIds
                : [resolvedSlide!.id];

            idsToUpdate.forEach(id => updateSlide(id, updates));
        } else {
            // Apply to ALL slides in current song
            if (selectedSongId) {
                const song = songs.find(s => s.id === selectedSongId);
                if (!song) return;

                // Optimized batch update
                const newSlides = song.slides.map(s => ({ ...s, ...updates }));
                updateSong(selectedSongId, { slides: newSlides });
            } else {
                // Fallback for non-song slides
                updateSlide(resolvedSlide!.id, updates);
            }
        }
    };

    const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value;
        setLocalFontFamily(newValue); // Immediate UI update
        applyChange({ fontFamily: newValue });
    };

    const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const size = parseInt(e.target.value);
        if (!isNaN(size)) {
            setLocalFontSize(size); // Immediate UI update
            applyChange({ fontSize: size });
        }
    };

    return (
        <div className="p-4 flex-1">
            <div className="flex items-center gap-2 mb-4">
                <Settings size={18} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-300">Propiedades</h3>
            </div>

            <div className="space-y-4">
                {/* Song Title (compact, inline) — only shown when a song is selected */}
                {selectedSong && (
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Título</label>
                        <input
                            type="text"
                            value={selectedSong.title}
                            onChange={(e) => updateSong(selectedSong.id, { title: e.target.value })}
                            className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}

                {/* Compact Scope Toggle */}
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Ámbito</span>
                    <div className="flex bg-zinc-800 rounded p-0.5 border border-gray-700">
                        <button
                            onClick={() => setEditScope('selection')}
                            className={`py-1 px-3 rounded text-[10px] flex items-center gap-1.5 transition-all ${editScope === 'selection'
                                ? 'bg-cyan-600 text-white'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <CheckSquare size={10} />
                            {selectedSlideIds.length > 1 ? `${selectedSlideIds.length}` : '1'}
                        </button>
                        <button
                            onClick={() => setEditScope('all')}
                            className={`py-1 px-3 rounded text-[10px] flex items-center gap-1.5 transition-all ${editScope === 'all'
                                ? 'bg-cyan-600 text-white'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <Layers size={10} />
                            All
                        </button>
                    </div>
                </div>

                {/* DYNAMIC CONTEXT SWITCHING */}
                {isVideo ? (
                    <VideoControls slide={resolvedSlide} />
                ) : (
                    <>
                        {/* Font Family */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Fuente</label>
                            <select
                                value={localFontFamily}
                                onChange={handleFontFamilyChange}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {FONT_FAMILIES.map(font => (
                                    <option key={font} value={font}>{font}</option>
                                ))}
                            </select>
                        </div>

                        {/* Font Size Control (Merged) */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs text-gray-400">Tamaño</label>
                                <span className="text-xs text-gray-500">{localFontSize} px</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="12"
                                    max="200"
                                    step="2"
                                    value={localFontSize}
                                    onChange={handleFontSizeChange}
                                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                                {/* Compact Number Input */}
                                <input
                                    type="number"
                                    value={localFontSize}
                                    onChange={handleFontSizeChange}
                                    min="12"
                                    max="200"
                                    className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Background Media Info */}
                {resolvedSlide.backgroundMedia && (
                    <div className="pt-2 border-t border-gray-700">
                        <label className="block text-xs text-gray-400 mb-1">
                            Medio de Fondo
                        </label>
                        <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-400 truncate flex items-center justify-between">
                            <span>{resolvedSlide.backgroundMedia.split('/').pop()}</span>
                            {/* Type badge */}
                            <span className="text-[10px] uppercase bg-black px-1 rounded text-gray-500">
                                {isVideo ? 'VIDEO' : 'IMG'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
            
            <NdiToggle />
        </div>
    );
};

export default PropertiesPanel;
