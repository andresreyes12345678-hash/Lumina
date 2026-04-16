import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import SlideCard from './SlideCard';
import { Slide, SlideType, TYPE_LABELS } from '../../types';
import { Plus, Upload, Book, Music, RefreshCw } from 'lucide-react';
import SongImportModal from '../Modals/SongImportModal';

const ProductionGrid: React.FC = () => {
    const {
        selectedSongId,
        songs,
        slides: directSlides,
        // Actions
        addSlide,
        reorderSlides,
        selectedSlideIds,
        toggleSlideSelection,
        clearSlideSelection,
        setSlideSelection,
        setActiveSlide
    } = useStore();

    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null); // For context menu
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);

    // Reflow state
    const [reflowState, setReflowState] = useState<{
        isEditMode: boolean;
        initialText: string;
        initialTitle: string;
        editSongId: string;
        preservedStyles?: { fontFamily: string; fontSize: number };
        originalSlides?: Slide[];
    } | null>(null);

    const { activeTab, contentSource, bibleState } = useStore();

    // Get current slides based on Active Tab or Content Source
    // If activeTab is 'media', we fall back to contentSource ('songs' or 'bible')
    // to keep the grid persistent.
    const effectiveTab = (activeTab === 'media') ? contentSource : activeTab;

    const selectedSong = songs.find(s => s.id === selectedSongId);

    let slides: Slide[] = [];
    if (effectiveTab === 'songs') {
        slides = selectedSong?.slides || [];
    } else if (effectiveTab === 'bible') {
        slides = directSlides;
    }

    const handleAddSlide = () => {
        if (!selectedSongId) {
            alert('Selecciona una canción primero o crea una nueva');
            return;
        }

        const newSlide: Slide = {
            id: `slide-${Date.now()}`,
            content: 'Nueva diapositiva',
            fontFamily: 'Poppins',
            fontSize: 64
        };

        addSlide(newSlide);
    };

    const handleImportText = () => {
        setReflowState(null); // Ensure clean new-song mode
        setIsImportModalOpen(true);
    };

    const handleReflowClick = () => {
        if (!selectedSong) return;

        // Reverse-import: concatenate all slide text with double newline separators
        const fullText = selectedSong.slides
            .map(slide => slide.content.trim())
            .join('\n\n');

        // Capture current visual styles from the first slide (reference)
        const firstSlide = selectedSong.slides[0];
        const preservedStyles = {
            fontFamily: firstSlide?.fontFamily || 'Poppins',
            fontSize: firstSlide?.fontSize || 64
        };

        setReflowState({
            isEditMode: true,
            initialText: fullText,
            initialTitle: selectedSong.title,
            editSongId: selectedSong.id,
            preservedStyles,
            originalSlides: selectedSong.slides
        });
        setIsImportModalOpen(true);
    };

    const handleImportModalClose = () => {
        setIsImportModalOpen(false);
        setReflowState(null);
    };

    // ----- SELECTION LOGIC -----
    const handleSlideClick = (e: React.MouseEvent, slide: Slide, index: number) => {
        // e.stopPropagation(); // Handled in SlideCard? No, we need it here.

        // START: Prioritize Modifier Keys (User Request 3)
        if (e.ctrlKey || e.metaKey) {
            // Multi-select toggle (Edit Mode)
            // Works independent of whether it is active or not (User Request 2)
            toggleSlideSelection(slide.id, true);
            return; // Stop here, do not project if just toggling selection
        }

        if (e.shiftKey) {
            // Range select (Edit Mode)
            if (selectedSlideIds.length > 0) {
                const lastSelectedId = selectedSlideIds[selectedSlideIds.length - 1];
                const lastIndex = slides.findIndex(s => s.id === lastSelectedId);
                if (lastIndex !== -1) {
                    const start = Math.min(lastIndex, index);
                    const end = Math.max(lastIndex, index);
                    const rangeIds = slides.slice(start, end + 1).map(s => s.id);
                    setSlideSelection(Array.from(new Set([...selectedSlideIds, ...rangeIds])));
                }
            } else {
                setSlideSelection([slide.id]);
            }
            return; // Stop here, do not project range
        }

        // Normal Click:
        // 1. Projects the slide (Live)
        // 2. Selects only this slide for editing
        // 3. User Request 2: "System seems to block... Allow consecutive clicks"
        // Since we are NOT returning early above, a normal click always does this:
        setActiveSlide(slide, index);
        setSlideSelection([slide.id]);
    };

    const handleBackgroundClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            clearSlideSelection();
        }
    };

    // ----- DRAG AND DROP -----
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedSlideIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, _index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedSlideIndex === null || !selectedSongId) return;

        if (draggedSlideIndex !== dropIndex) {
            reorderSlides(selectedSongId, draggedSlideIndex, dropIndex);
        }
        setDraggedSlideIndex(null);
    };

    const handleContextMenu = (e: React.MouseEvent, slideId: string) => {
        e.preventDefault();
        setSelectedSlideId(slideId); // For context menu operations
        if (!selectedSlideIds.includes(slideId)) {
            // If right-clicking outside selection, select strictly this one
            setSlideSelection([slideId]);
        }

        // Calculate safe position
        const menuWidth = 220;
        const menuHeight = 550;
        let x = e.clientX;
        let y = e.clientY;

        // Horizontal clamp
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }

        // Vertical collision detection
        // If it doesn't fit below, try to put it above
        if (y + menuHeight > window.innerHeight) {
            y = y - menuHeight;
        }

        // Safety clamp: Prevent going off the top
        if (y < 10) {
            y = 10;
            // If it's clamped to top and still too tall, we might need to rely on CSS scroll (max-h)
        }

        // Safety clamp: Prevent going off the bottom (if clamped to top pushes it down? No, standard logic)
        // If after flipping up it's still weird (e.g. huge menu on small screen), ensure it stays within bounds
        if (y + menuHeight > window.innerHeight) {
            // If it doesn't fit anywhere, align to bottom
            y = window.innerHeight - menuHeight - 10;
        }

        setContextMenuPos({ x, y });
        setShowContextMenu(true);
    };

    const handleAssignType = (type: SlideType) => {
        // Apply to ALL selected slides if multiple
        const idsToUpdate = selectedSlideIds.length > 0 ? selectedSlideIds : (selectedSlideId ? [selectedSlideId] : []);

        idsToUpdate.forEach(id => {
            useStore.getState().setSlideType(id, type);
        });

        setShowContextMenu(false);
    };

    const handleUnassignType = () => {
        const idsToUpdate = selectedSlideIds.length > 0 ? selectedSlideIds : (selectedSlideId ? [selectedSlideId] : []);
        idsToUpdate.forEach(id => {
            useStore.getState().setSlideType(id, null);
        });
        setShowContextMenu(false);
    };

    const handleEdit = () => {
        if (selectedSlideId) {
            useStore.getState().startEditing(selectedSlideId);
        }
        setShowContextMenu(false);
    };

    const handleDelete = () => {
        if (selectedSlideId) {
            useStore.getState().deleteSlide(selectedSlideId);
        }
        setShowContextMenu(false);
    };

    // Close context menu on click outside
    React.useEffect(() => {
        const handleClick = () => setShowContextMenu(false);
        if (showContextMenu) {
            window.addEventListener('click', handleClick);
            return () => window.removeEventListener('click', handleClick);
        }
    }, [showContextMenu]);

    // Helper for context menu badge colors
    const getMenuBadgeColor = (type: string) => {
        if (type.startsWith('verso')) return 'bg-blue-600 border-blue-400';
        if (type.startsWith('coro')) return 'bg-red-600 border-red-400';
        if (type.startsWith('puente')) return 'bg-green-600 border-green-400';
        if (type === 'intro' || type === 'final') return 'bg-yellow-500 border-yellow-300 text-black';
        return 'bg-zinc-700 border-gray-600';
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="bg-zinc-900 border-b border-gray-700 p-4 flex flex-col gap-2">
                <div className="flex gap-2">
                    <button
                        onClick={handleAddSlide}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                    >
                        <Plus size={18} />
                        Nueva Slide
                    </button>
                    <button
                        onClick={handleImportText}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                    >
                        <Upload size={18} />
                        Importar Texto
                    </button>
                    <button
                        onClick={handleReflowClick}
                        disabled={!selectedSong}
                        title={selectedSong ? `Rediseñar "${selectedSong.title}"` : 'Selecciona una canción primero'}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={18} />
                        Rediseñar
                    </button>
                </div>

                {/* Dynamic Header - Premium Redesign */}
                {effectiveTab === 'songs' && selectedSong && (
                    <div className="mt-2 bg-gradient-to-r from-blue-900 to-zinc-900 border-l-4 border-blue-500 rounded-r-md p-4 shadow-lg flex justify-between items-center group relative overflow-hidden">
                        {/* Background Decoration */}
                        <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-blue-500/5 to-transparent pointer-events-none" />

                        <div className="flex items-center gap-4 z-10">
                            <div className="h-10 w-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                <Music size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-wide leading-tight">
                                    {selectedSong.title}
                                </h2>
                                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium mt-0.5">
                                    <span className="bg-zinc-700/50 px-1.5 py-0.5 rounded text-gray-300 border border-gray-700">
                                        {slides.length} slides
                                    </span>
                                    {selectedSong.artist && (
                                        <>
                                            <span className="text-gray-600">•</span>
                                            <span>{selectedSong.artist}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {selectedSlideIds.length > 0 && (
                            <div className="z-10 animate-in fade-in slide-in-from-right-4 duration-300">
                                <span className="text-xs font-bold text-blue-200 bg-blue-900/40 border border-blue-500/30 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    {selectedSlideIds.length} seleccionadas
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {effectiveTab === 'bible' && bibleState.book && (
                    <div className="mt-2 bg-gradient-to-r from-emerald-900 to-zinc-900 border-l-4 border-emerald-500 rounded-r-md p-4 shadow-lg flex justify-between items-center group relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
                        <div className="flex items-center gap-4 z-10">
                            <div className="h-10 w-10 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                <Book size={20} className="text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-wide leading-tight">
                                    {bibleState.book} {bibleState.chapter}
                                </h2>
                                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium mt-0.5">
                                    <span className="bg-zinc-700/50 px-1.5 py-0.5 rounded text-gray-300 border border-gray-700">
                                        {slides.length} versículos
                                    </span>
                                    {bibleState.version && (
                                        <>
                                            <span className="text-gray-600">•</span>
                                            <span className="uppercase">{bibleState.version}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        {selectedSlideIds.length > 0 && (
                            <div className="z-10 animate-in fade-in slide-in-from-right-4 duration-300">
                                <span className="text-xs font-bold text-emerald-200 bg-emerald-900/40 border border-emerald-500/30 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {selectedSlideIds.length} seleccionados
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Grid */}
            <div
                className="flex-1 overflow-auto p-6"
                onClick={handleBackgroundClick}
            >
                {slides.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <p className="text-xl mb-2">No hay diapositivas</p>
                            <p className="text-sm">
                                {selectedSongId
                                    ? 'Crea una nueva o importa texto'
                                    : 'Selecciona una canción de la lista lateral'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        {slides.map((slide, index) => {
                            // --- VISUAL PROPAGATION LOGIC (Refactored to Linear O(N)) ---
                            // Check local calculation directly to avoid loop errors
                            let effectiveType = slide.type;

                            if (!effectiveType) {
                                // Simple linear backward lookup (safer than loop inside return)
                                // Since we render in order, we can trust the previous sibling's effective type?
                                // No, React renders independently. We need to look at data.
                                // BUT, instead of a loop, let's just hold state? No, render is pure.

                                // Let's use the robust loop but simpler
                                try {
                                    let found = undefined;
                                    for (let k = index - 1; k >= 0; k--) {
                                        const s = slides[k];
                                        if (s && s.type) {
                                            found = s.type;
                                            break;
                                        }
                                    }
                                    if (found) effectiveType = found;
                                } catch (e) {
                                    // Ignore
                                }
                            }
                            const isAnchor = !!slide.type;

                            return (
                                <div
                                    key={slide.id}
                                    draggable={!!selectedSongId} // Enable drag only for songs
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onClick={(e) => handleSlideClick(e, slide, index)}
                                >
                                    <SlideCard
                                        slide={slide}
                                        index={index}
                                        onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, slide.id)}
                                        // Make sure SlideCard allows click propagation or accepts onClick replacement
                                        isSelected={selectedSlideIds.includes(slide.id)}
                                        // New Props for Section Visuals
                                        inheritedType={effectiveType}
                                        isAnchor={isAnchor}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {showContextMenu && (
                <div
                    className="fixed bg-zinc-800 border border-gray-700 rounded-md shadow-xl py-2 min-w-[220px] z-50 max-h-[90vh] overflow-y-auto"
                    style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Check if slide is Bible type */}
                    {slides.find(s => s.id === selectedSlideId)?.type === 'bible' ? (
                        <div className="px-3 py-2 text-xs text-yellow-500 italic text-center border-b border-gray-700 mb-1">
                            Diapositiva Bíblica<br />(Edición restringida)
                        </div>
                    ) : (
                        <>
                            {/* Edit Option at Top */}
                            <button
                                onClick={handleEdit}
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm border-b border-gray-700 font-semibold text-white"
                            >
                                Editar Contenido
                            </button>

                            <div className="px-3 py-1 text-xs text-gray-400 font-semibold mt-1">Asignar Tipo</div>

                            <div className="border-t border-gray-700 my-1" />

                            {/* Versos */}
                            <div className="px-2 py-1">
                                {(['verso1', 'verso2', 'verso3'] as SlideType[]).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => handleAssignType(type)}
                                        className="w-full text-left px-2 py-1 hover:bg-zinc-700/50 rounded text-sm flex items-center gap-3 transition-colors mb-1"
                                    >
                                        <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs border shadow-sm ${getMenuBadgeColor(type)}`}>
                                            {type === 'verso1' ? 'A' : type === 'verso2' ? 'S' : 'D'}
                                        </span>
                                        <span className="text-gray-200">{TYPE_LABELS[type]}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-gray-700 my-1 slate-600" />

                            {/* Coros */}
                            <div className="px-2 py-1">
                                {(['coro1', 'coro2', 'coro3'] as SlideType[]).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => handleAssignType(type)}
                                        className="w-full text-left px-2 py-1 hover:bg-zinc-700/50 rounded text-sm flex items-center gap-3 transition-colors mb-1"
                                    >
                                        <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs border shadow-sm ${getMenuBadgeColor(type)}`}>
                                            {type === 'coro1' ? 'C' : type === 'coro2' ? 'X' : 'Z'}
                                        </span>
                                        <span className="text-gray-200">{TYPE_LABELS[type]}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-gray-700 my-1 slate-600" />

                            {/* Puentes */}
                            <div className="px-2 py-1">
                                {(['puente1', 'puente2'] as SlideType[]).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => handleAssignType(type)}
                                        className="w-full text-left px-2 py-1 hover:bg-zinc-700/50 rounded text-sm flex items-center gap-3 transition-colors mb-1"
                                    >
                                        <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs border shadow-sm ${getMenuBadgeColor(type)}`}>
                                            {type === 'puente1' ? 'B' : 'N'}
                                        </span>
                                        <span className="text-gray-200">{TYPE_LABELS[type]}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-gray-700 my-1 slate-600" />

                            {/* Intro/Final */}
                            <div className="px-2 py-1">
                                {(['intro', 'final'] as SlideType[]).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => handleAssignType(type)}
                                        className="w-full text-left px-2 py-1 hover:bg-zinc-700/50 rounded text-sm flex items-center gap-3 transition-colors mb-1"
                                    >
                                        <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs border shadow-sm ${getMenuBadgeColor(type)}`}>
                                            {type === 'intro' ? 'I' : 'E'}
                                        </span>
                                        <span className="text-gray-200">{TYPE_LABELS[type]}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-gray-700 my-1" />

                            <button
                                onClick={handleUnassignType}
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-gray-300"
                            >
                                ✕ Desasignar Tipo
                            </button>
                        </>
                    )}

                    {/* Delete is always allowed */}
                    <div className="border-t border-gray-700 my-1" />
                    <button
                        onClick={handleDelete}
                        className="w-full text-left px-4 py-2 hover:bg-red-600/20 text-sm text-red-400"
                    >
                        Eliminar
                    </button>
                </div>
            )}

            <SongImportModal
                isOpen={isImportModalOpen}
                onClose={handleImportModalClose}
                isEditMode={reflowState?.isEditMode}
                initialText={reflowState?.initialText}
                initialTitle={reflowState?.initialTitle}
                editSongId={reflowState?.editSongId}
                preservedStyles={reflowState?.preservedStyles}
                originalSlides={reflowState?.originalSlides}
            />
        </div>
    );
};

export default ProductionGrid;
