import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Slide, Song } from '../../types';

interface SongImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Reflow / Edit Mode props
    initialText?: string;
    initialTitle?: string;
    isEditMode?: boolean;
    editSongId?: string;
    preservedStyles?: { fontFamily: string; fontSize: number };
    originalSlides?: Slide[];
}

const SongImportModal: React.FC<SongImportModalProps> = ({
    isOpen,
    onClose,
    initialText,
    initialTitle,
    isEditMode = false,
    editSongId,
    preservedStyles,
    originalSlides
}) => {
    const { songFolders, addSong, setSelectedSong, updateSong } = useStore();

    const [title, setTitle] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [folderId, setFolderId] = useState('default');

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            // Edit mode: pre-fill with existing song data
            if (isEditMode && initialTitle) {
                setTitle(initialTitle);
                setLyrics(initialText || '');
                // Keep the folder from the existing song
                if (editSongId) {
                    const song = useStore.getState().songs.find(s => s.id === editSongId);
                    if (song) setFolderId(song.folderId);
                }
                return; // Skip clipboard auto-paste in edit mode
            }

            // New song mode: reset fields
            setTitle('');
            setLyrics('');
            const folders = useStore.getState().songFolders;
            if (folders.length > 0) {
                setFolderId(folders[0].id);
            }

            // Auto-paste from clipboard
            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(text => {
                    if (text && text.trim().length > 0) {
                        setLyrics(text);
                    }
                }).catch(err => {
                    console.warn('[SongImportModal] Clipboard access failed:', err);
                });
            }
        }
    }, [isOpen, isEditMode, initialText, initialTitle, editSongId]);

    // Real-time slide generation for preview and saving
    const slideFont = preservedStyles?.fontFamily || 'Poppins';
    const slideSize = preservedStyles?.fontSize || 109;

    const generatedSlides = React.useMemo(() => {
        const paragraphs = lyrics.split(/\r?\n\s*\r?\n/);
        
        // Build a pool of existing types to preserve anchors
        const pendingTypes = originalSlides?.filter(s => s.type).map(s => ({
            type: s.type,
            content: s.content.trim()
        })) || [];

        return paragraphs
            .filter(p => p.trim().length > 0)
            .map((rawContent, index) => {
                const content = rawContent.trim();
                let assignedType = undefined;

                for (let i = 0; i < pendingTypes.length; i++) {
                    const pt = pendingTypes[i];
                    if (
                        content === pt.content ||
                        pt.content.startsWith(content) ||
                        content.startsWith(pt.content)
                    ) {
                        assignedType = pt.type;
                        pendingTypes.splice(i, 1);
                        break;
                    }
                }

                return {
                    id: `slide-preview-${index}`, // Temporary ID for preview
                    content: content,
                    fontFamily: slideFont,
                    fontSize: slideSize,
                    type: assignedType
                } as Slide;
            });
    }, [lyrics, originalSlides, slideFont, slideSize]);

    const handleSave = () => {
        if (!title.trim() || !lyrics.trim()) return;

        if (generatedSlides.length === 0) {
            alert('No se pudieron generar diapositivas. Asegúrate de separar las estrofas con doble salto de línea.');
            return;
        }

        // Give them final unique IDs
        const newSlides = generatedSlides.map((s, idx) => ({
            ...s,
            id: `slide-${Date.now()}-${idx}`
        }));

        if (isEditMode && editSongId) {
            // EDIT MODE: Overwrite the existing song's slides (preserve ID, folder, dates)
            updateSong(editSongId, {
                title: title.trim(),
                slides: newSlides
            });
            console.log(`[SongImportModal] Reflow: Updated song "${title}" with ${newSlides.length} slides`);
        } else {
            // NEW MODE: Create a new song
            const newSong: Song = {
                id: `song-${Date.now()}`,
                title: title.trim(),
                folderId,
                slides: newSlides,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            addSong(newSong);
            setSelectedSong(newSong.id);
        }

        onClose();
    };

    if (!isOpen) return null;

    const previewCount = generatedSlides.length;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-blue-500">{isEditMode ? '✎' : '♫'}</span>
                        {isEditMode ? 'Rediseñar Canción' : 'Configuración de Canción'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-700/50">
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Two Columns */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
                    {/* Left Column: Editor */}
                    <div className="p-6 space-y-6 overflow-y-auto border-r border-gray-700 flex flex-col">
                        {/* Title & Folder */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2 space-y-2">
                                <label className="block text-sm font-medium text-gray-300">Título de la Canción</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Sublime Gracia"
                                    className="w-full bg-zinc-900 border border-gray-700 rounded-md px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300">Carpeta</label>
                                <select
                                    value={folderId}
                                    onChange={(e) => setFolderId(e.target.value)}
                                    disabled={isEditMode}
                                    className="w-full bg-zinc-900 border border-gray-700 rounded-md px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                >
                                    {songFolders.map(folder => (
                                        <option key={folder.id} value={folder.id}>{folder.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Edit Mode Info Banner */}
                        {isEditMode && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/20 border border-amber-700/40 rounded-md text-xs text-amber-300">
                                <span className="font-bold">⚡ Modo Rediseño:</span>
                                <span>Redistribuye el texto usando doble enter para separar slides. Se sobreescribirán las diapositivas actuales.</span>
                            </div>
                        )}

                        {/* Lyrics */}
                        <div className="space-y-2 flex-1 flex flex-col">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-300">Letra de la Canción</label>
                                <span className="text-xs text-blue-400 font-mono bg-blue-900/20 px-2 py-0.5 rounded">
                                    Separa estrofas con doble enter
                                </span>
                            </div>
                            <textarea
                                value={lyrics}
                                onChange={(e) => setLyrics(e.target.value)}
                                placeholder="Pega la letra aquí..."
                                className="w-full h-full min-h-[300px] bg-zinc-900 border border-gray-700 rounded-md p-4 text-gray-200 font-sans leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Right Column: Live Preview */}
                    <div className="bg-zinc-900/50 p-6 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Previsualización</h4>
                            <span className="text-xs bg-zinc-800 text-gray-400 px-2 py-1 rounded-md border border-gray-700">
                                {previewCount} Slides
                            </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-max">
                            {generatedSlides.length === 0 ? (
                                <div className="col-span-full h-full flex items-center justify-center text-gray-600 text-sm italic border-2 border-dashed border-gray-800 rounded-lg p-8">
                                    El texto ingresado aparecerá aquí en forma de diapositivas...
                                </div>
                            ) : (
                                generatedSlides.map((slide, i) => (
                                    <div key={slide.id} className="relative aspect-video bg-black border border-gray-700 rounded-md flex items-center justify-center p-2 shadow-lg group overflow-hidden">
                                        <div className="absolute top-1 left-1.5 text-[9px] font-bold text-gray-500 z-10 bg-black/60 px-1 rounded">
                                            {i + 1}
                                        </div>
                                        {slide.type && (
                                            <div className="absolute top-1 right-1.5 text-[9px] font-bold text-blue-400 z-10 bg-blue-900/40 px-1 rounded uppercase">
                                                {slide.type}
                                            </div>
                                        )}
                                        <div 
                                            className="text-center text-white break-words w-full"
                                            style={{ 
                                                fontFamily: slide.fontFamily, 
                                                fontSize: `clamp(8px, ${(slide.fontSize || 80) / 10}px, 20px)`, // Scale down massively for preview card
                                                lineHeight: '1.2'
                                            }}
                                        >
                                            {slide.content.split('\n').map((line, idx) => (
                                                <React.Fragment key={idx}>
                                                    {line}
                                                    {idx < slide.content.split('\n').length - 1 && <br />}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 flex items-center justify-between bg-zinc-800/50">
                    <div className="text-sm text-gray-400">
                        Se generarán <strong className="text-white">{previewCount}</strong> diapositivas
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!title.trim() || !lyrics.trim()}
                            className={`px-6 py-2 text-sm font-semibold text-white rounded-md shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                                isEditMode
                                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                            }`}
                        >
                            {isEditMode ? 'Aplicar Rediseño' : 'Crear Canción'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SongImportModal;
