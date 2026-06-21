import React, { useState } from 'react';
import { Search, Folder, ChevronRight, ChevronDown, Music, FolderPlus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Song, SongFolder } from '../../types';
import InputModal from '../Modals/InputModal';
import ConfirmModal from '../Modals/ConfirmModal';

const SongsPanel: React.FC = () => {
    const {
        songs,
        songFolders,
        selectedSongId,
        setSelectedSong,
        updateSong,
        deleteSong,
        addSongFolder,
        updateSongFolder,
        deleteSongFolder,
        songsState,
        setSongsState
    } = useStore();

    const { searchQuery, expandedFolders } = songsState;

    // Context menu states
    const [contextMenu, setContextMenu] = useState<{
        show: boolean;
        x: number;
        y: number;
        type: 'folder' | 'song';
        id: string;
    } | null>(null);

    // Modal states
    const [inputModal, setInputModal] = useState<{
        isOpen: boolean;
        title: string;
        initialValue: string;
        onSave: (val: string) => void;
    }>({
        isOpen: false,
        title: '',
        initialValue: '',
        onSave: () => { }
    });

    // Confirmation Modal
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    // Drag and drop
    const [draggedItem, setDraggedItem] = useState<{ type: 'song'; id: string } | null>(null);

    const toggleFolder = (folderId: string) => {
        const isExpanded = expandedFolders.includes(folderId);
        const newExpanded = isExpanded
            ? expandedFolders.filter(id => id !== folderId)
            : [...expandedFolders, folderId];

        setSongsState({ expandedFolders: newExpanded });
    };

    const handleSelectSong = (song: Song) => {
        setSelectedSong(song.id);
    };

    const createNewFolder = () => {
        setInputModal({
            isOpen: true,
            title: 'Nueva Carpeta',
            initialValue: '',
            onSave: (name) => {
                const newFolder: SongFolder = {
                    id: `folder-${Date.now()}`,
                    name
                };
                addSongFolder(newFolder);
                // Expand new folder automatically
                setSongsState({ expandedFolders: [...expandedFolders, newFolder.id] });
            }
        });
    };

    const renameFolder = (folderId: string) => {
        const folder = songFolders.find(f => f.id === folderId);
        if (!folder) return;

        setInputModal({
            isOpen: true,
            title: 'Renombrar Carpeta',
            initialValue: folder.name,
            onSave: (newName) => {
                updateSongFolder(folderId, { name: newName });
            }
        });
    };

    const deleteFolder = (folderId: string) => {
        const folder = songFolders.find(f => f.id === folderId);
        const songsInFolder = songs.filter(s => s.folderId === folderId);

        if (songsInFolder.length > 0) {
            const confirmDelete = window.confirm(
                `¿Eliminar carpeta "${folder?.name}" y sus ${songsInFolder.length} canciones?`
            );
            if (!confirmDelete) return;
        }

        deleteSongFolder(folderId);
    };

    const renameSong = (songId: string) => {
        const song = songs.find(s => s.id === songId);
        if (!song) return;

        setInputModal({
            isOpen: true,
            title: 'Renombrar Canción',
            initialValue: song.title,
            onSave: (newName) => {
                updateSong(songId, { title: newName });
            }
        });
    };

    const deleteSongItem = (songId: string) => {
        const song = songs.find(s => s.id === songId);
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Canción',
            message: `¿Estás seguro de que deseas eliminar "${song?.title || 'esta canción'}"? Esta acción no se puede deshacer.`,
            onConfirm: () => deleteSong(songId)
        });
    };

    const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'song', id: string) => {
        e.preventDefault();
        e.stopPropagation();

        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            type,
            id
        });
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    const handleDragStart = (songId: string) => {
        setDraggedItem({ type: 'song', id: songId });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (folderId: string) => {
        if (!draggedItem || draggedItem.type !== 'song') return;

        updateSong(draggedItem.id, { folderId });
        setDraggedItem(null);
    };

    // Helper to normalize strings (remove accents/diacritics and make lowercase)
    const normalizeString = (str: string) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    // Filter songs by search query
    const filteredSongs = songs.filter(song => {
        const query = normalizeString(searchQuery);
        const titleText = normalizeString(song.title);
        const lyricsText = normalizeString(song.slides.map(s => s.content).join(' '));
        return (
            titleText.includes(query) ||
            lyricsText.includes(query)
        );
    });

    // Sort Folders: System folders first (General top), then Alphabetical
    const sortedFolders = [...songFolders].sort((a, b) => {
        if (a.isSystemFolder && !b.isSystemFolder) return -1;
        if (!a.isSystemFolder && b.isSystemFolder) return 1;
        if (a.id === 'general-songs') return -1;
        if (b.id === 'general-songs') return 1;
        return a.name.localeCompare(b.name);
    });

    // Group by folder
    const songsByFolder = sortedFolders.map(folder => {
        const folderSongs = filteredSongs.filter(s => s.folderId === folder.id);
        // Sort songs alphabetically
        folderSongs.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }));
        return {
            ...folder,
            songs: folderSongs
        };
    }).filter(folder => folder.songs.length > 0 || searchQuery === '');

    // Close context menu on click
    React.useEffect(() => {
        if (contextMenu) {
            window.addEventListener('click', closeContextMenu);
            return () => window.removeEventListener('click', closeContextMenu);
        }
    }, [contextMenu]);

    return (
        <div className="h-full flex flex-col p-4">
            {/* Search and Create Folder Button */}
            <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                    <button
                        onClick={createNewFolder}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm"
                    >
                        <FolderPlus size={16} />
                        Nueva Carpeta
                    </button>

                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSongsState({ searchQuery: e.target.value })}
                        placeholder="Buscar por título o letra..."
                        className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Folder Tree */}
            <div className="flex-1 overflow-auto space-y-1">
                {songsByFolder.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm mt-8">
                        No se encontraron canciones
                    </div>
                ) : (
                    songsByFolder.map(folder => {
                        const isExpanded = (searchQuery.trim() !== '') || expandedFolders.includes(folder.id);

                        return (
                            <div
                                key={folder.id}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(folder.id)}
                            >
                                {/* Folder Header */}
                                <div
                                    onClick={() => toggleFolder(folder.id)}
                                    onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded-md cursor-pointer transition-colors"
                                >
                                    {isExpanded ? (
                                        <ChevronDown size={16} className="text-gray-400" />
                                    ) : (
                                        <ChevronRight size={16} className="text-gray-400" />
                                    )}
                                    <Folder size={16} className="text-yellow-500" />
                                    <span className="text-sm font-semibold text-gray-200">
                                        {folder.name}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-auto">
                                        ({folder.songs.length})
                                    </span>
                                </div>

                                {/* Songs in Folder */}
                                {isExpanded && (
                                    <div className="ml-6 mt-1 space-y-1">
                                        {folder.songs.map(song => {
                                            const isSelected = selectedSongId === song.id;
                                            const previewText = song.slides[0]?.content.split('\n')[0] || '';

                                            return (
                                                <div
                                                    key={song.id}
                                                    draggable
                                                    onDragStart={() => handleDragStart(song.id)}
                                                    onClick={() => handleSelectSong(song)}
                                                    onContextMenu={(e) => handleContextMenu(e, 'song', song.id)}
                                                    className={`
                            flex items-start gap-2 p-2 border rounded-md cursor-pointer transition-all
                            ${isSelected
                                                            ? 'bg-blue-900/30 border-blue-600 shadow-lg'
                                                            : 'bg-gray-800 hover:bg-gray-750 border-gray-700'
                                                        }
                          `}
                                                >
                                                    <Music size={14} className={`mt-0.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-200' : 'text-gray-100'}`}>
                                                            {song.title}
                                                        </h4>
                                                        <p className="text-xs text-gray-400 line-clamp-1">
                                                            {previewText}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {song.slides.length} slides
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-zinc-800 border border-gray-700 rounded-md shadow-xl py-2 min-w-[160px] z-50"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'folder' && !songFolders.find(f => f.id === contextMenu.id)?.isSystemFolder ? (
                        <>
                            <button
                                onClick={() => {
                                    renameFolder(contextMenu.id);
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                            >
                                Renombrar
                            </button>
                            <button
                                onClick={() => {
                                    deleteFolder(contextMenu.id);
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-red-600/20 text-sm text-red-400"
                            >
                                Eliminar
                            </button>
                        </>
                    ) : contextMenu.type === 'folder' ? (
                        <div className="px-4 py-2 text-xs text-gray-500 italic text-center">
                            Carpeta del Sistema
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    renameSong(contextMenu.id);
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                            >
                                Renombrar
                            </button>
                            <button
                                onClick={() => {
                                    deleteSongItem(contextMenu.id);
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-red-600/20 text-sm text-red-400"
                            >
                                Eliminar
                            </button>
                        </>
                    )}
                </div>
            )}

            <InputModal
                isOpen={inputModal.isOpen}
                onClose={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
                title={inputModal.title}
                initialValue={inputModal.initialValue}
                onSave={inputModal.onSave}
            />

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                isDanger={true}
                confirmText="Eliminar"
            />
        </div>
    );
};

export default SongsPanel;
