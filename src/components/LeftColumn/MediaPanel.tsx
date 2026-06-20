import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Video, Folder, ChevronRight, ChevronDown, FolderPlus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MediaFile, MediaFolder } from '../../types';

import InputModal from '../Modals/InputModal';
import ConfirmModal from '../Modals/ConfirmModal';

const MediaPanel: React.FC = () => {
    const {
        mediaFiles,
        mediaFolders,
        deleteMediaFile,
        addMediaFolder,
        updateMediaFolder,
        deleteMediaFolder,
        expandedFolderIds,
        toggleFolderExpansion
    } = useStore();

    // Use global state for expansion
    const expandedFolders = expandedFolderIds;

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [contextMenu, setContextMenu] = useState<{
        show: boolean;
        x: number;
        y: number;
        type: 'folder' | 'media';
        id: string;
    } | null>(null);

    // Modal state for Create/Rename
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
    const [draggedItem, setDraggedItem] = useState<{ type: 'media'; id: string } | null>(null);

    const toggleFolder = (folderId: string) => {
        toggleFolderExpansion(folderId);
    };



    // --- Media Manager Integration ---
    const [conversionProgress, setConversionProgress] = useState<{ file: string, percent: number } | null>(null);

    React.useEffect(() => {
        if (window.electronAPI && window.electronAPI.getMediaLibrary) {
            // Load initial library
            // Load initial library
            window.electronAPI.getMediaLibrary().then((files: any[]) => {
                const currentFiles = useStore.getState().mediaFiles;
                const mappedFiles: MediaFile[] = files.map(f => {
                    const existing = currentFiles.find(curr => curr.id === f.id);
                    return {
                        id: f.id,
                        name: f.name,
                        url: `lumina-media://${f.path.replace(/\\/g, '/')}`,
                        type: f.type,
                        thumbnailUrl: f.thumbnail ? `lumina-media://${f.thumbnail.replace(/\\/g, '/')}` : undefined,
                        folderId: f.folderId || existing?.folderId || 'general-media',
                        scaling: f.scaling || existing?.scaling || 'contain',
                        isLooping: f.isLooping || existing?.isLooping || false
                    };
                });
                useStore.setState({ mediaFiles: mappedFiles });
            });

            // Listen for updates
            const removeLibraryListener = window.electronAPI?.on?.('media:library-update', (files: any[]) => {
                console.log('[MediaPanel] Received library-update event with', files.length, 'files');
                const currentFiles = useStore.getState().mediaFiles;
                const mappedFiles: MediaFile[] = files.map(f => {
                    const existing = currentFiles.find(curr => curr.id === f.id);
                    return {
                        id: f.id,
                        name: f.name,
                        url: `lumina-media://${f.path.replace(/\\/g, '/')}`,
                        type: f.type,
                        thumbnailUrl: f.thumbnail ? `lumina-media://${f.thumbnail.replace(/\\/g, '/')}` : undefined,
                        folderId: f.folderId || existing?.folderId || 'general-media',
                        scaling: f.scaling || existing?.scaling || 'contain',
                        isLooping: f.isLooping || existing?.isLooping || false
                    };
                });
                console.log('[MediaPanel] Mapped to', mappedFiles.length, 'MediaFile objects');
                useStore.setState({ mediaFiles: mappedFiles });
                console.log('[MediaPanel] Store updated with new mediaFiles');
            });

            // Listen for progress
            const removeProgressListener = window.electronAPI?.on?.('media:conversion-progress', (data: any) => {
                setConversionProgress(data);
                if (data.percent >= 100) {
                    setTimeout(() => setConversionProgress(null), 2000);
                }
            });

            return () => {
                if (removeLibraryListener) removeLibraryListener();
                if (removeProgressListener) removeProgressListener();
            };
        }
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        if (!window.electronAPI?.importMedia) {
            console.error('[MediaPanel] Media Manager API not available');
            return;
        }

        const fileArray = Array.from(files);
        // Extract paths for Electron - try both methods
        const paths = fileArray.map(f => {
            // Method 1: Direct path property (works in packaged apps)
            if ((f as any).path) return (f as any).path;
            // Method 2: Use webUtils (works in development)
            try {
                return window.electronAPI.getFilePath(f);
            } catch (e) {
                console.error('[MediaPanel] getFilePath failed:', e);
                return null;
            }
        });

        const validPaths = paths.filter(p => !!p) as string[];

        if (validPaths.length === 0) {
            console.error('[MediaPanel] Could not extract file paths');
            return;
        }

        console.log('[MediaPanel] Calling importMedia with paths:', validPaths);
        try {
            const result = await window.electronAPI.importMedia(validPaths);
            console.log('[MediaPanel] Import result:', result);

            // Explicitly reload library after import to ensure UI updates
            // (in case the library-update event was lost due to timing/reload)
            if (window.electronAPI.getMediaLibrary) {
                console.log('[MediaPanel] Reloading library after import...');
                const files = await window.electronAPI.getMediaLibrary();
                const currentFiles = useStore.getState().mediaFiles;
                const mappedFiles: MediaFile[] = files.map((f: any) => {
                    const existing = currentFiles.find(curr => curr.id === f.id);
                    return {
                        id: f.id,
                        name: f.name,
                        url: `lumina-media://${f.path.replace(/\\/g, '/')}`,
                        type: f.type,
                        thumbnailUrl: f.thumbnail ? `lumina-media://${f.thumbnail.replace(/\\/g, '/')}` : undefined,
                        folderId: f.folderId || existing?.folderId || 'general-media', // Backend might not store folderId yet? Trust backend if present.
                        scaling: f.scaling || existing?.scaling || 'contain',
                        isLooping: f.isLooping || existing?.isLooping || false
                    };
                });
                console.log('[MediaPanel] Updating store with', mappedFiles.length, 'files after import');
                useStore.setState({ mediaFiles: mappedFiles });
            }
        } catch (e) {
            console.error('[MediaPanel] Import error:', e);
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();

        if (!window.electronAPI?.importMedia) {
            console.error('[MediaPanel] Media Manager API not available');
            return;
        }

        const files = e.dataTransfer.files;
        const fileArray = Array.from(files);

        const paths = fileArray.map(f => {
            if ((f as any).path) return (f as any).path;
            try {
                return window.electronAPI.getFilePath(f);
            } catch (e) {
                console.error('[MediaPanel] getFilePath failed:', e);
                return null;
            }
        });

        const validPaths = paths.filter(p => !!p) as string[];

        if (validPaths.length > 0) {
            await window.electronAPI.importMedia(validPaths);

            // Reload library after import
            if (window.electronAPI.getMediaLibrary) {
                const files = await window.electronAPI.getMediaLibrary();
                const currentFiles = useStore.getState().mediaFiles;
                const mappedFiles: MediaFile[] = files.map((f: any) => {
                    const existing = currentFiles.find(curr => curr.id === f.id);
                    return {
                        id: f.id,
                        name: f.name,
                        url: `lumina-media://${f.path.replace(/\\/g, '/')}`,
                        type: f.type,
                        thumbnailUrl: f.thumbnail ? `lumina-media://${f.thumbnail.replace(/\\/g, '/')}` : undefined,
                        folderId: f.folderId || existing?.folderId || 'general-media',
                        scaling: f.scaling || existing?.scaling || 'contain',
                        isLooping: f.isLooping || existing?.isLooping || false
                    };
                });
                useStore.setState({ mediaFiles: mappedFiles });
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDelete = (id: string, name?: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Multimedia',
            message: `¿Estás seguro de que deseas eliminar "${name || 'este archivo'}"? Esta acción no se puede deshacer.`,
            onConfirm: async () => {
                // Optimistic delete or wait for server?
                // Let's call server, if success, store will update via listener, 
                // OR we can manually remove locally too for speed.
                if (window.electronAPI && window.electronAPI.deleteMedia) {
                    const result = await window.electronAPI.deleteMedia(id);
                    // If failed, maybe alert?
                    if (!result.success) console.warn("Delete failed:", result.error);
                }
                // Fallback for local-only state if API fails or not present
                deleteMediaFile(id);
            }
        });
    };

    const handleSetBackground = (media: MediaFile) => {
        const { setGlobalBackgroundMedia } = useStore.getState();
        setGlobalBackgroundMedia(media.url, media.scaling, media.type, media.id, media.isLooping);
        console.log(`Global background set to: ${media.name} (${media.scaling}, ${media.type})`);
    };

    const createNewFolder = () => {
        setInputModal({
            isOpen: true,
            title: 'Nueva Carpeta',
            initialValue: '',
            onSave: (name) => {
                const newFolder: MediaFolder = {
                    id: `folder-${Date.now()}`,
                    name
                };
                addMediaFolder(newFolder);
                if (!expandedFolders.includes(newFolder.id)) {
                    toggleFolderExpansion(newFolder.id);
                }
                setInputModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const renameFolder = (folderId: string) => {
        const folder = mediaFolders.find(f => f.id === folderId);
        if (!folder) return;

        setInputModal({
            isOpen: true,
            title: 'Renombrar Carpeta',
            initialValue: folder.name,
            onSave: (newName) => {
                updateMediaFolder(folderId, { name: newName });
                setInputModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const deleteFolderItem = (folderId: string) => {
        if (folderId === 'general-media') {
            alert('No se puede eliminar la carpeta "General"');
            return;
        }

        const folder = mediaFolders.find(f => f.id === folderId);
        const filesInFolder = mediaFiles.filter(m => m.folderId === folderId);

        if (filesInFolder.length > 0) {
            const confirmDelete = window.confirm(
                `¿Eliminar carpeta "${folder?.name}"? Los archivos se moverán a "General"`
            );
            if (!confirmDelete) return;
        }

        deleteMediaFolder(folderId);
    };

    const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'media', id: string) => {
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

    const handleMediaDragStart = (mediaId: string) => {
        setDraggedItem({ type: 'media', id: mediaId });
    };

    const handleFolderDrop = (folderId: string) => {
        if (!draggedItem || draggedItem.type !== 'media') return;

        const mediaFile = mediaFiles.find(m => m.id === draggedItem.id);
        if (mediaFile) {
            const { updateMediaFile } = useStore.getState();
            updateMediaFile(draggedItem.id, { folderId });
        }

        setDraggedItem(null);
    };

    // Sort Folders: System folders first, then Alphabetical
    const sortedFolders = [...mediaFolders].sort((a, b) => {
        if (a.isSystemFolder && !b.isSystemFolder) return -1;
        if (!a.isSystemFolder && b.isSystemFolder) return 1;
        // If both are system, prioritize General
        if (a.id === 'general-media') return -1;
        if (b.id === 'general-media') return 1;
        return a.name.localeCompare(b.name);
    });

    // Group files by folder
    const filesByFolder = sortedFolders.map(folder => {
        const matchingFiles = mediaFiles.filter(f => {
            // Defensive: Treat undefined/null folderId as 'general-media'
            const fileFolderId = f.folderId || 'general-media';
            return fileFolderId === folder.id;
        });

        // console.log(`[MediaPanel] Folder '${folder.name}' (${folder.id}) has ${matchingFiles.length} files. Total mediaFiles: ${mediaFiles.length}`);

        return {
            ...folder,
            files: matchingFiles
        }
    });

    // Close context menu
    React.useEffect(() => {
        if (contextMenu) {
            window.addEventListener('click', closeContextMenu);
            return () => window.removeEventListener('click', closeContextMenu);
        }
    }, [contextMenu]);

    return (
        <div className="h-full flex flex-col p-4">
            {/* Conversion Progress */}
            {conversionProgress && (
                <div className="mb-4 bg-zinc-800 rounded-md p-3 border border-blue-500/30">
                    <div className="flex justify-between text-xs text-blue-300 mb-1">
                        <span>Procesando: {conversionProgress.file}</span>
                        <span>{Math.round(conversionProgress.percent)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${conversionProgress.percent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Upload Button */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
            />

            <div className="flex gap-2 mb-4">
                <button
                    onClick={createNewFolder}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm"
                    title="Nueva Carpeta"
                >
                    <FolderPlus size={16} />
                    Nueva Carpeta
                </button>
            </div>

            {/* Drag & Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-700 rounded-md p-4 mb-4 text-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload size={24} className="mx-auto mb-1 opacity-50" />
                <p className="text-xs">Arrastra archivos aquí</p>
            </div>

            {/* Folder Tree with Media */}
            <div className="flex-1 overflow-auto space-y-1">
                {filesByFolder.map(folder => {
                    const isExpanded = expandedFolders.includes(folder.id);
                    const fileCount = folder.files.length;

                    return (
                        <div
                            key={folder.id}
                            onDragOver={handleDragOver}
                            onDrop={() => handleFolderDrop(folder.id)}
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
                                    ({fileCount})
                                </span>
                            </div>

                            {/* Media Grid */}
                            {isExpanded && fileCount > 0 && (
                                <div className="ml-6 mt-2 mb-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        {folder.files.map(media => (
                                            <div
                                                key={media.id}
                                                draggable
                                                onDragStart={() => handleMediaDragStart(media.id)}
                                                className="relative aspect-video bg-gray-800 rounded-md overflow-hidden border border-gray-700 group cursor-move"
                                                onClick={() => handleSetBackground(media)}
                                                onContextMenu={(e) => handleContextMenu(e, 'media', media.id)}
                                            >
                                                {/* Thumbnail Strategy: Use IMG if generated, else fallback to VID */}
                                                {media.type === 'image' || media.thumbnailUrl ? (
                                                    <img
                                                        src={media.thumbnailUrl || media.url}
                                                        alt={media.name}
                                                        className={`w-full h-full ${media.scaling === 'fill' ? 'object-fill' : 'object-contain'}`}
                                                    />
                                                ) : (
                                                    // Legacy fallback for videos without thumb
                                                    <video
                                                        src={media.url}
                                                        preload="metadata"
                                                        muted
                                                        onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                                                        onMouseOut={(e) => {
                                                            const vid = e.target as HTMLVideoElement;
                                                            vid.pause();
                                                            vid.currentTime = 0;
                                                        }}
                                                        className={`w-full h-full ${media.scaling === 'fill' ? 'object-fill' : 'object-contain'}`}
                                                    />
                                                )}

                                                {/* Overlay */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <div className="text-white text-xs">
                                                        {media.type === 'image' ? <ImageIcon size={20} /> : <Video size={20} />}
                                                    </div>
                                                </div>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(media.id, media.name);
                                                    }}
                                                    className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} className="text-white" />
                                                </button>

                                                {/* Type Badge */}
                                                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-white text-[10px]">
                                                    {media.type === 'image' ? 'IMG' : 'VID'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isExpanded && fileCount === 0 && (
                                <div className="ml-6 mt-2 mb-2 text-xs text-gray-500 italic">
                                    Vacío
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-zinc-800 border border-gray-700 rounded-md shadow-xl py-2 min-w-[160px] z-50"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'folder' && !mediaFolders.find(f => f.id === contextMenu.id)?.isSystemFolder ? (
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
                                    deleteFolderItem(contextMenu.id);
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
                        // Media Context Menu
                        <>
                            <button
                                onClick={() => {
                                    const { updateMediaFile } = useStore.getState();
                                    const media = mediaFiles.find(m => m.id === contextMenu.id);
                                    if (media) {
                                        const newScaling = media.scaling === 'fill' ? 'contain' : 'fill';
                                        updateMediaFile(media.id, { scaling: newScaling });

                                        // STRICT SNAPSHOT RULE: 
                                        // We do NOT update the live background here. 
                                        // The user must click the media again to "Push" the changes to live.
                                    }
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                            >
                                {mediaFiles.find(m => m.id === contextMenu.id)?.scaling === 'fill'
                                    ? 'Ajustar (Sin deformar)'
                                    : 'Estirar (Rellenar)'}
                            </button>
                            <button
                                onClick={() => {
                                    const media = mediaFiles.find(m => m.id === contextMenu.id);
                                    if (media) handleDelete(media.id, media.name);
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

            {/* Stats */}
            <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
                {mediaFiles.length} archivos en {mediaFolders.length} carpetas
            </div>

            {/* Input Modal */}
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

export default MediaPanel;
