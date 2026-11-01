import { create } from 'zustand';
import { Slide, SlideType, Song, SongFolder, MediaFolder, MediaFile } from '../types';

interface Store {
    // Active slide state
    activeSlide: Slide | null;
    activeSlideIndex: number;

    // Songs management
    // Songs management
    songs: Song[];
    selectedSongId: string | null;
    songFolders: SongFolder[];

    // Internal Loading State (Guard)
    isLoaded: boolean;

    // Media management
    mediaFiles: MediaFile[];
    mediaFolders: MediaFolder[];

    // All slides collection (Used for Bible Mode)
    slides: Slide[];


    // Editor state
    isEditing: boolean;
    editingSlideId: string | null;

    // Settings Modal State
    isSettingsOpen: boolean;
    setSettingsOpen: (isOpen: boolean) => void;

    // Global Transitions
    globalTransitionType: 'fade' | 'slide' | 'zoom';
    globalTransitionSpeed: number;
    setGlobalTransition: (type: 'fade' | 'slide' | 'zoom', speed: number) => void;

    // Grid / Tab State
    activeTab: 'songs' | 'bible' | 'media';
    contentSource: 'songs' | 'bible'; // Tracks what should be shown in Grid
    setActiveTab: (tab: 'songs' | 'bible' | 'media') => void;

    // Layer visibility states
    textLayerVisible: boolean;
    mediaLayerVisible: boolean;

    // Global background (Snapshot)
    activeMediaSnapshot: {
        id?: string; // Added for persistence
        url: string;
        type: 'image' | 'video';
        scaling: 'contain' | 'cover' | 'fill';
        timestamp?: number;
        isLooping?: boolean; // Added for persistence
    } | null;
    setGlobalBackgroundMedia: (url: string, scaling?: 'contain' | 'cover' | 'fill', type?: 'image' | 'video', id?: string, isLooping?: boolean) => void;

    // Song actions
    addSong: (song: Song) => void;
    updateSong: (songId: string, updates: Partial<Song>) => void;
    deleteSong: (songId: string) => void;
    setSelectedSong: (songId: string | null) => void;

    // Song folder actions
    addSongFolder: (folder: SongFolder) => void;
    updateSongFolder: (folderId: string, updates: Partial<SongFolder>) => void;
    deleteSongFolder: (folderId: string) => void;

    // Media actions
    addMediaFile: (file: MediaFile) => void;
    updateMediaFile: (fileId: string, updates: Partial<MediaFile>) => void; // Added
    deleteMediaFile: (fileId: string) => void;
    addMediaFolder: (folder: MediaFolder) => void;
    updateMediaFolder: (folderId: string, updates: Partial<MediaFolder>) => void;
    deleteMediaFolder: (folderId: string) => void;

    // Slide actions
    setActiveSlide: (slide: Slide | null, index?: number) => void;
    addSlide: (slide: Slide) => void;
    addSlides: (slides: Slide[]) => void;
    updateSlide: (id: string, updates: Partial<Slide>) => void;
    deleteSlide: (id: string) => void;

    // Multi-selection & Reorder
    selectedSlideIds: string[];
    toggleSlideSelection: (id: string, multi: boolean) => void;
    clearSlideSelection: () => void;
    setSlideSelection: (ids: string[]) => void;
    reorderSlides: (songId: string, fromIndex: number, toIndex: number) => void;

    // CRITICAL: Exclusive type assignment
    setSlideType: (slideId: string, type: SlideType | null) => void;

    // Navigation
    nextSlide: () => void;
    previousSlide: () => void;

    // Editor controls
    startEditing: (slideId: string) => void;
    stopEditing: () => void;

    // Clear layer controls
    clearTextLayer: () => void;
    clearMediaLayer: () => void;
    blackout: () => void;
    showAllLayers: () => void;

    // Clear all
    clearSlides: () => void;

    // Bible State Persistence
    bibleState: {
        version: string;
        book: string;
        chapter: string;
        lastVerse: string;
        searchQuery: string;
        customChapterStyles?: Record<string, { fontSize?: number; fontFamily?: string }>;
    };
    setBibleState: (updates: Partial<Store['bibleState']>) => void;
    updateBibleSlides: (updates: Partial<Slide>) => void;

    // Songs State Persistence
    songsState: {
        searchQuery: string;
        expandedFolders: string[];
    };
    setSongsState: (updates: Partial<Store['songsState']>) => void;

    // Media State Persistence (UI)
    expandedFolderIds: string[]; // Set of expanded folder IDs
    toggleFolderExpansion: (folderId: string) => void;

    // Video Playback State (Global Runtime)
    videoPlaybackState: {
        isPlaying: boolean;
        isLooping: boolean;
        volume: number;
        currentTime: number;
        duration: number;
        seekTime?: number;
        seekTrigger?: number;
    };
    setVideoPlaybackState: (updates: Partial<Store['videoPlaybackState']>) => void;
    reportVideoStatus: (status: Partial<Store['videoPlaybackState']>) => void;
    setVolume: (volume: number) => void; // Dedicated volume control with IPC

    // Projection Mode
    isProjectionActive: boolean;
    toggleProjection: () => void;
    syncStageDisplay: () => void;

    // Persistence
    loadFromStorage: () => Promise<void>;
    saveToStorage: () => void;
    resetData: () => void;
}

// Helper to send separated layers to Stage Display
const sendToStageDisplay = (slide: Slide | null, textVisible: boolean, mediaVisible: boolean) => {
    if (!window.electronAPI) return;

    const { activeMediaSnapshot, videoPlaybackState } = useStore.getState();

    // 1. If NO slide is active, but we have a background to show
    if (!slide) {
        if (mediaVisible && activeMediaSnapshot) {
            window.electronAPI.triggerSlide({
                id: 'background-only',
                content: '',
                backgroundMedia: activeMediaSnapshot.url || '',
                backgroundMediaType: activeMediaSnapshot.type,
                backgroundScaling: activeMediaSnapshot.scaling,
                type: undefined,
                videoControl: {
                    ...videoPlaybackState,
                    isLooping: activeMediaSnapshot.isLooping ?? videoPlaybackState.isLooping ?? false
                }
            });
        } else {
            // Blackout / Clear
            window.electronAPI.triggerSlide({
                id: 'blackout',
                content: '',
                // No background media, allowing ScalableSlide to trigger its 500ms fadeOut
                backgroundColor: 'black'
            } as Slide);
        }
        return;
    }

    // 2. Normal case: Active slide
    const payload = {
        ...slide,
        content: textVisible ? slide.content : '',
        // Use Snapshot if media is visible, otherwise undefined
        backgroundMedia: mediaVisible ? (activeMediaSnapshot?.url || undefined) : undefined,
        backgroundMediaType: mediaVisible ? (activeMediaSnapshot?.type || undefined) : undefined,
        backgroundScaling: mediaVisible ? (activeMediaSnapshot?.scaling || 'contain') : undefined,
        // NEW: Pass timestamp to decouple render logic
        backgroundTimestamp: mediaVisible ? (activeMediaSnapshot?.timestamp || 0) : 0,
        // Runtime Video Control
        videoControl: {
            ...videoPlaybackState,
            isLooping: videoPlaybackState.isLooping ?? slide.isLooping ?? false // Runtime preference overrides slide, default false
        },
        // Global Transition
        transitionType: useStore.getState().globalTransitionType,
        transitionSpeed: useStore.getState().globalTransitionSpeed
    };

    window.electronAPI.triggerSlide(payload);
};

// ── Persistence ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'lumina-data';

// Tiempo de agrupación de escrituras: ráfagas de cambios (reordenar, editar texto, etc.)
// se guardan UNA sola vez. En un crash se pierde como máximo este margen;
// al cerrar la app se fuerza el guardado inmediato (ver flush-before-close en main.cjs).
const SAVE_DEBOUNCE_MS = 1500;

// WHITELIST: únicos campos que se guardan Y se restauran en loadFromStorage().
// Todo lo transitorio (diapositiva activa, video, selección, modales) queda fuera.
const PERSISTED_KEYS = [
    'songs',
    'songFolders',
    'mediaFolders',
    'expandedFolderIds',
    'bibleState',
    'songsState',
    'activeTab',
    'contentSource',
    'globalTransitionType',
    'globalTransitionSpeed'
] as const;

const pickPersisted = (state: Store) => {
    const payload: Record<string, unknown> = {};
    for (const key of PERSISTED_KEYS) payload[key] = state[key];
    return payload;
};

// --- Electron Persistence ---
const loadFromLocalStorage = async () => {
    if (window.electronAPI?.loadData) {
        console.log('[Store] Loading data from Electron...');
        return await window.electronAPI.loadData();
    }
    // Fallback?
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveDirty = false;

const writeToDisk = async () => {
    const state = useStore.getState();

    // GUARD: Prevent saving if not loaded to avoid wiping DB with initial state
    if (!state.isLoaded) {
        console.warn('[Store] Save BLOCKED: Store not fully loaded yet.');
        return;
    }

    // STRINGIFY ON FRONTEND to avoid Structured Clone Algorithm blocking
    let cleanPayloadStr: string;
    try {
        cleanPayloadStr = JSON.stringify(pickPersisted(state), null, 2);
    } catch (err) {
        console.error('[Store] CRITICAL: Data format error - Object not serializable:', err);
        return;
    }

    if (window.electronAPI?.saveData) {
        try {
            await window.electronAPI.saveData(cleanPayloadStr);
        } catch (err) {
            console.error('[Store] Save failed:', err);
        }
    } else {
        localStorage.setItem(STORAGE_KEY, cleanPayloadStr);
    }
};

// Escribe de inmediato si hay cambios pendientes (cierre de app, migraciones).
export const flushSave = async (): Promise<void> => {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (!saveDirty) return;
    saveDirty = false;
    await writeToDisk();
};

// Marca cambios pendientes y (re)inicia el debounce. Siempre guarda el estado MÁS RECIENTE.
const scheduleSave = () => {
    if (!useStore.getState().isLoaded) {
        console.warn('[Store] Save BLOCKED: Store not fully loaded yet.');
        return;
    }
    saveDirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void flushSave();
    }, SAVE_DEBOUNCE_MS);
};

// commit(): aplica un cambio al store y programa su persistencia. Reemplaza el patrón
// set() + saveToLocalStorage({...state, ...newState}) que se repetía en cada acción CRUD.
const commit = (change: Partial<Store> | ((state: Store) => Partial<Store>)) => {
    useStore.setState(change);
    scheduleSave();
};

export const useStore = create<Store>((set, get) => ({
    activeSlide: null,
    activeSlideIndex: -1,
    isLoaded: false, // Start false
    songs: [],
    selectedSongId: null,
    songFolders: [
        { id: 'general-songs', name: 'General', isSystemFolder: true },
        { id: 'folder-1', name: 'Alabanza' },
        { id: 'folder-2', name: 'Adoración' }
    ],
    mediaFiles: [], // Purged as requested
    mediaFolders: [
        { id: 'general-media', name: 'General', isSystemFolder: true },
        // Default folder removed. 'Sin Carpeta' is legacy.
        { id: 'folder-1', name: 'Fondos de Alabanza' },
        { id: 'folder-2', name: 'Fondos de Adoración' }
    ],
    expandedFolderIds: ['general-media'], // Open General by default
    slides: [], // Kept for Bible Mode / Generic Slides
    isEditing: false,
    editingSlideId: null,
    
    // Settings state
    isSettingsOpen: false,
    setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
    
    // Global Transitions
    globalTransitionType: 'fade',
    globalTransitionSpeed: 200,
    setGlobalTransition: (type, speed) => commit({ globalTransitionType: type, globalTransitionSpeed: speed }),
    
    textLayerVisible: true,
    mediaLayerVisible: true,
    activeMediaSnapshot: null,
    
    // Default projection state. Wil be overridden if loaded from storage
    isProjectionActive: false,

    toggleProjection: () => {
        // Estado transitorio (no se persiste): solo actualiza el store y avisa al Main Process
        set({ isProjectionActive: !get().isProjectionActive });

        // Notify Main Process to show or hide the projection window
        if (window.electronAPI && window.electronAPI.toggleProjection) {
            window.electronAPI.toggleProjection();
        }
    },
    syncStageDisplay: () => {
        const state = get();
        sendToStageDisplay(state.activeSlide, state.textLayerVisible, state.mediaLayerVisible);
    },
    videoPlaybackState: {
        isPlaying: true,
        isLooping: false,
        volume: 0.8,        // Default 80% — previously was 0 (silently muted)
        currentTime: 0,
        duration: 0,
        seekTime: undefined,
        seekTrigger: undefined
    },

    setVideoPlaybackState: (updates) => {
        set((state) => {
            const nextState = { ...state.videoPlaybackState, ...updates };
            if (updates.seekTime !== undefined) {
                nextState.seekTrigger = Date.now();
            }
            return { videoPlaybackState: nextState };
        });

        // DIRECT IPC SYNC (For instant response)
        if (window.electronAPI && window.electronAPI.sendVideoControl) {
            // Determine action based on updates
            if (updates.isPlaying !== undefined) {
                window.electronAPI.sendVideoControl({
                    action: updates.isPlaying ? 'play' : 'pause'
                });
            }
            if (updates.isLooping !== undefined) {
                window.electronAPI.sendVideoControl({
                    action: 'loop',
                    value: updates.isLooping
                });
            }
            if (updates.seekTime !== undefined) {
                window.electronAPI.sendVideoControl({
                    action: 'seek',
                    time: updates.seekTime
                });
            }
        }
    },

    reportVideoStatus: (status) => {
        set((state) => ({
            videoPlaybackState: { ...state.videoPlaybackState, ...status }
        }));
    },

    // Dedicated volume setter — updates store AND sends IPC directly to Stage (bypasses full slide trigger)
    setVolume: (volume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        set((state) => ({
            videoPlaybackState: { ...state.videoPlaybackState, volume: clampedVolume }
        }));
        if (window.electronAPI?.sendVideoVolume) {
            window.electronAPI.sendVideoVolume(clampedVolume);
        }
    },

    // Bible State
    bibleState: {
        version: 'rvr1960',
        book: '',
        chapter: '',
        lastVerse: '',
        searchQuery: ''
    },

    setBibleState: (updates) => {
        // Sanitize: ensure all fields are strings (persisted data may have undefined)
        const merged = { ...get().bibleState, ...updates };
        const newBibleState = {
            version:     merged.version     || 'rvr1960',
            book:        merged.book        || '',
            chapter:     merged.chapter     || '',
            lastVerse:   merged.lastVerse   || '',
            searchQuery: merged.searchQuery || '',
            customChapterStyles: merged.customChapterStyles || {},
        };

        // Skip disk IO if the user is typing in the search bar
        const isOnlySearchQuery = Object.keys(updates).length === 1 && 'searchQuery' in updates;
        if (isOnlySearchQuery) {
            set({ bibleState: newBibleState });
        } else {
            commit({ bibleState: newBibleState });
        }
    },

    updateBibleSlides: (updates) => {
        commit((state) => {
            const newSlides = state.slides.map(s => ({ ...s, ...updates }));

            const newBibleState = { ...state.bibleState };
            if (!newBibleState.customChapterStyles) newBibleState.customChapterStyles = {};

            const chapterKey = `${state.bibleState.book}-${state.bibleState.chapter}`;
            const currentStyles = newBibleState.customChapterStyles[chapterKey] || {};

            newBibleState.customChapterStyles[chapterKey] = {
                ...currentStyles,
                ...updates
            };

            return { slides: newSlides, bibleState: newBibleState };
        });
    },

    // Songs State Persistence
    songsState: {
        searchQuery: '',
        expandedFolders: ['folder-1'] // Default expanded
    },

    setSongsState: (updates: Partial<Store['songsState']>) => {
        const newSongsState = { ...get().songsState, ...updates };

        // Skip disk IO if the user is typing in the search bar
        const isOnlySearchQuery = Object.keys(updates).length === 1 && 'searchQuery' in updates;
        if (isOnlySearchQuery) {
            set({ songsState: newSongsState });
        } else {
            commit({ songsState: newSongsState });
        }
    },

    // Song management
    addSong: (song) => {
        commit((state) => ({ songs: [...state.songs, song] }));
    },

    updateSong: (songId, updates) => {
        commit((state) => ({
            songs: state.songs.map(song =>
                song.id === songId
                    ? { ...song, ...updates, updatedAt: Date.now() }
                    : song
            )
        }));
    },

    deleteSong: (songId) => {
        commit((state) => ({
            songs: state.songs.filter(s => s.id !== songId),
            selectedSongId: state.selectedSongId === songId ? null : state.selectedSongId
        }));
    },

    setSelectedSong: (songId) => {
        set({ selectedSongId: songId });
        set({ selectedSlideIds: [] });
    },

    // Song folder management
    addSongFolder: (folder) => {
        commit((state) => ({ songFolders: [...state.songFolders, folder] }));
    },

    updateSongFolder: (folderId, updates) => {
        const folder = get().songFolders.find(f => f.id === folderId);
        if (folder?.isSystemFolder) {
            console.warn('Cannot rename system folder:', folder.name);
            return;
        }
        commit((state) => ({
            songFolders: state.songFolders.map(f =>
                f.id === folderId ? { ...f, ...updates } : f
            )
        }));
    },

    deleteSongFolder: (folderId) => {
        const folder = get().songFolders.find(f => f.id === folderId);
        if (folder?.isSystemFolder) {
            console.warn('Cannot delete system folder:', folder.name);
            return;
        }
        commit((state) => ({
            songFolders: state.songFolders.filter(f => f.id !== folderId),
            // Move songs to General folder
            songs: state.songs.map(s => s.folderId === folderId ? { ...s, folderId: 'general-songs' } : s)
        }));
    },

    // Media management
    // NOTA: mediaFiles NO se persiste en lumina_db.json (se purga en loadFromStorage);
    // la persistencia real vive en media-db.json (mediaManager.cjs). Por eso usan set(), no commit().
    addMediaFile: (file) => {
        set((state) => ({ mediaFiles: [...state.mediaFiles, file] }));
    },

    updateMediaFile: (fileId, updates) => {
        set((state) => ({
            mediaFiles: state.mediaFiles.map(f =>
                f.id === fileId ? { ...f, ...updates } : f
            )
        }));

        // PERSISTENCE: Save to JSON DB via Electron
        if (window.electronAPI && window.electronAPI.updateMedia) {
            window.electronAPI.updateMedia(fileId, updates).catch(err =>
                console.error('[Store] Failed to persist media update:', err)
            );
        }
    },

    deleteMediaFile: (fileId) => {
        set((state) => ({ mediaFiles: state.mediaFiles.filter(f => f.id !== fileId) }));
    },

    addMediaFolder: (folder) => {
        commit((state) => ({ mediaFolders: [...state.mediaFolders, folder] }));
    },

    updateMediaFolder: (folderId, updates) => {
        const folder = get().mediaFolders.find(f => f.id === folderId);
        if (folder?.isSystemFolder) {
            console.warn('Cannot rename system folder:', folder.name);
            return;
        }
        commit((state) => ({
            mediaFolders: state.mediaFolders.map(f =>
                f.id === folderId ? { ...f, ...updates } : f
            )
        }));
    },

    deleteMediaFolder: (folderId) => {
        const folder = get().mediaFolders.find(f => f.id === folderId);
        if (folder?.isSystemFolder) {
            console.warn('Cannot delete system folder:', folder.name);
            return;
        }
        commit((state) => ({
            mediaFolders: state.mediaFolders.filter(f => f.id !== folderId),
            mediaFiles: state.mediaFiles.map(f =>
                f.folderId === folderId ? { ...f, folderId: 'general-media' } : f
            )
        }));
    },

    toggleFolderExpansion: (folderId) => {
        commit((state) => {
            const current = state.expandedFolderIds || [];
            return {
                expandedFolderIds: current.includes(folderId)
                    ? current.filter((id) => id !== folderId)
                    : [...current, folderId]
            };
        });
    },

    setActiveSlide: (slide, index) => {
        // Find index logic mainly applies to songs
        const { selectedSongId, songs } = get();

        let actualIndex = index;
        let slideToProject = slide;

        // CRITICAL: Ensure we project the LATEST version from the library (Snapshot Logic)
        if (slide && selectedSongId) {
            const song = songs.find(s => s.id === selectedSongId);
            const foundSlide = song?.slides.find(s => s.id === slide.id);
            if (foundSlide) {
                slideToProject = foundSlide; // Use the fresh version from library
                actualIndex = song?.slides.findIndex(s => s.id === slide.id) ?? -1;
            }
        }

        // AUTO-ENABLE LAYERS logic
        const { mediaLayerVisible } = get();

        if (slideToProject) {
            set({ activeSlide: slideToProject, activeSlideIndex: actualIndex, textLayerVisible: true });
            sendToStageDisplay(slideToProject, true, mediaLayerVisible);
        } else {
            set({ activeSlide: null, activeSlideIndex: actualIndex ?? -1, textLayerVisible: false });
            // We pass textVisible=false explicitly
            sendToStageDisplay(null, false, mediaLayerVisible);
        }
    },

    addSlide: (slide) => {
        const { selectedSongId, songs } = get();

        if (selectedSongId) {
            get().updateSong(selectedSongId, {
                slides: [...(songs.find(s => s.id === selectedSongId)?.slides || []), slide]
            });
        }
    },

    addSlides: (newSlides) => {
        const { selectedSongId, songs } = get();

        if (selectedSongId) {
            get().updateSong(selectedSongId, {
                slides: [...(songs.find(s => s.id === selectedSongId)?.slides || []), ...newSlides]
            });
        }
    },

    updateSlide: (id, updates) => {
        const { selectedSongId, songs } = get();

        // 1. Update in Songs list (Persistence - Library State)
        if (selectedSongId) {
            const song = songs.find(s => s.id === selectedSongId);
            if (song) {
                get().updateSong(selectedSongId, {
                    slides: song.slides.map(slide =>
                        slide.id === id ? { ...slide, ...updates } : slide
                    )
                });
            }
        }

        // 2. Fallback: Update in global slides (Bible / Quick Slides)
        const { slides } = get();
        if (slides.some(s => s.id === id)) {
            set({
                slides: slides.map(slide =>
                    slide.id === id ? { ...slide, ...updates } : slide
                )
            });
        }

        // REMOVED: Live State update. Editing should NEVER affect the live "Active Slide". 
        // The live slide is a "Snapshot" taken at the moment of triggering.
    },

    setSlideType: (slideId, type) => {
        const { selectedSongId, songs } = get();

        // Guard: No song selected
        if (!selectedSongId) return;

        const songIndex = songs.findIndex(s => s.id === selectedSongId);
        if (songIndex === -1) return;

        const song = songs[songIndex];

        // OPTIMIZATION: Single pass map
        // If type is not null (we are assigning a type), we must enforce exclusivity for this type
        // If type is null (removing type), we just clean the specific slide

        const newSlides = song.slides.map(slide => {
            // Case 1: Target Slide -> Assign new type (or remove if null)
            if (slide.id === slideId) {
                // If type is null, remove it. If type exists, assign it.
                if (type === null) {
                    const { type: _discard, ...rest } = slide;
                    return rest as Slide;
                }
                return { ...slide, type };
            }

            // Case 2: Other Slides -> If we are assigning a UNIQUE type (e.g. Verse 1), 
            // check if this other slide currently holds it to steal it.
            // Assumption: ALL types are exclusive per User Request ("solo un Verso 1").
            // If type is null (we are unassigning), we don't affect others.
            if (type !== null && slide.type === type) {
                const { type: _discard, ...rest } = slide;
                return rest as Slide;
            }

            // Case 3: Unaffected slide
            return slide;
        });

        // Update strictly the modified song
        const newSongs = [...songs];
        newSongs[songIndex] = { ...song, slides: newSlides, updatedAt: Date.now() };

        commit({ songs: newSongs });
    },

    deleteSlide: (id) => {
        const { selectedSongId, songs } = get();

        if (selectedSongId) {
            const song = songs.find(s => s.id === selectedSongId);
            if (song) {
                get().updateSong(selectedSongId, {
                    slides: song.slides.filter(slide => slide.id !== id)
                });
            }
        }
    },

    // Multi-selection implementation
    selectedSlideIds: [],

    toggleSlideSelection: (id, multi) => {
        const { selectedSlideIds } = get();
        if (multi) {
            if (selectedSlideIds.includes(id)) {
                set({ selectedSlideIds: selectedSlideIds.filter(sid => sid !== id) });
            } else {
                set({ selectedSlideIds: [...selectedSlideIds, id] });
            }
        } else {
            set({ selectedSlideIds: [id] });
        }
    },

    clearSlideSelection: () => {
        set({ selectedSlideIds: [] });
    },

    setSlideSelection: (ids) => {
        set({ selectedSlideIds: ids });
    },

    reorderSlides: (songId, fromIndex, toIndex) => {
        const { songs } = get();
        const song = songs.find(s => s.id === songId);
        if (!song) return;

        const slides = [...song.slides];
        const [movedSlide] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, movedSlide);

        get().updateSong(songId, { slides });
    },

    // Navegación unificada: lógica compartida por nextSlide() y previousSlide()
    // Antes era código espejo duplicado en ambas funciones
    nextSlide: () => {
        const { activeTab, slides, songs, selectedSongId, activeSlideIndex, contentSource } = get();
        const effectiveMode = (activeTab === 'media') ? contentSource : activeTab;

        if (effectiveMode === 'bible') {
            if (slides.length === 0) return;
            const nextIndex = activeSlideIndex < slides.length - 1 ? activeSlideIndex + 1 : activeSlideIndex;
            get().setActiveSlide(slides[nextIndex], nextIndex);
            return;
        }

        if (!selectedSongId) return;
        const currentSlides = songs.find(s => s.id === selectedSongId)?.slides || [];
        if (currentSlides.length === 0) return;
        const nextIndex = activeSlideIndex < currentSlides.length - 1 ? activeSlideIndex + 1 : activeSlideIndex;
        get().setActiveSlide(currentSlides[nextIndex], nextIndex);
    },

    previousSlide: () => {
        const { activeTab, slides, songs, selectedSongId, activeSlideIndex, contentSource } = get();
        const effectiveMode = (activeTab === 'media') ? contentSource : activeTab;

        if (effectiveMode === 'bible') {
            if (slides.length === 0) return;
            const prevIndex = activeSlideIndex > 0 ? activeSlideIndex - 1 : 0;
            get().setActiveSlide(slides[prevIndex], prevIndex);
            return;
        }

        if (!selectedSongId) return;
        const currentSlides = songs.find(s => s.id === selectedSongId)?.slides || [];
        if (currentSlides.length === 0) return;
        const prevIndex = activeSlideIndex > 0 ? activeSlideIndex - 1 : 0;
        get().setActiveSlide(currentSlides[prevIndex], prevIndex);
    },

    startEditing: (slideId) => {
        set({ isEditing: true, editingSlideId: slideId });
    },

    stopEditing: () => {
        set({ isEditing: false, editingSlideId: null });
    },

    // Clear layer controls
    clearTextLayer: () => {
        set({ textLayerVisible: false });
        const { activeSlide, mediaLayerVisible } = get();
        sendToStageDisplay(activeSlide, false, mediaLayerVisible);
    },

    clearMediaLayer: () => {
        set({ mediaLayerVisible: false });
        const { activeSlide, textLayerVisible } = get();
        sendToStageDisplay(activeSlide, textLayerVisible, false);
    },

    // Blackout unificado: oculta ambas capas y reutiliza sendToStageDisplay (mismo canal 'trigger-slide').
    // La diapositiva activa se conserva para poder volver con showAllLayers().
    blackout: () => {
        set({ textLayerVisible: false, mediaLayerVisible: false });
        sendToStageDisplay(null, false, false);
    },

    showAllLayers: () => {
        set({ textLayerVisible: true, mediaLayerVisible: true });
        const { activeSlide } = get();
        sendToStageDisplay(activeSlide, true, true);
    },





    setGlobalBackgroundMedia: (url, scaling = 'contain', type = 'image', id, isLooping = false) => {
        // Validation: If no URL is provided, don't set a snapshot (or clear it??)
        // But assuming valid media is passed here.

        const newSnapshot = {
            id,
            url,
            scaling,
            type,
            timestamp: Date.now(),
            isLooping
        };

        set((state) => ({
            activeMediaSnapshot: newSnapshot,
            mediaLayerVisible: true, // AUTO-SHOW MEDIA LAYER
            // SYNC RUNTIME STATE WITH PREFERENCE
            videoPlaybackState: {
                ...state.videoPlaybackState,
                isLooping: isLooping || false,
                currentTime: 0,
                seekTime: undefined,
                seekTrigger: undefined,
                isPlaying: true
            }
        }));

        // CRITICAL: Send IPC loop command so the Stage window picks up the persisted preference
        if (window.electronAPI && window.electronAPI.sendVideoControl) {
            window.electronAPI.sendVideoControl({
                action: 'loop',
                value: isLooping || false
            });
        }

        const { activeSlide, textLayerVisible } = get();
        // Pass 'true' for mediaVisible since we just enabled it
        sendToStageDisplay(activeSlide, textLayerVisible, true);
    },

    clearSlides: () => {
        set({ activeSlide: null, activeSlideIndex: -1 });
    },

    // Persistence
    loadFromStorage: async () => {
        console.log('[Store] Starting loadFromStorage...');
        let data = null;
        try {
            data = await loadFromLocalStorage();
        } catch (err) {
            console.error('[Store] CRITICAL: Failed to load data from storage:', err);
            // Fallback to allow app to function (and potentially overwrite corrupt data with fresh defaults on next save)
            // DataManager likely returned null anyway if it handled the error, but this catches IPC transport errors.
        }

        if (data) {
            console.log('[Store] Data loaded from persistence:', Object.keys(data));

            const currentState = get();

            // ENFORCE SYSTEM FOLDERS (Migration Logic)
            // Ensure 'General' folder exists for Media
            let mediaFolders = data.mediaFolders || [];

            // 1. Remove Legacy "default" folder if present
            mediaFolders = mediaFolders.filter((f: any) => f.id !== 'default');

            // 2. Ensure General exists
            if (!mediaFolders.find((f: any) => f.id === 'general-media')) {
                console.warn('[Store] Migrating: Adding missing general-media folder');
                mediaFolders = [
                    { id: 'general-media', name: 'General', isSystemFolder: true },
                    ...mediaFolders
                ];
            }

            // Ensure 'General' folder exists for Songs
            let songFolders = data.songFolders || [];
            if (!songFolders.find((f: any) => f.id === 'general-songs')) {
                console.warn('[Store] Migrating: Adding missing general-songs folder');
                songFolders = [
                    { id: 'general-songs', name: 'General', isSystemFolder: true },
                    ...songFolders
                ];
            }

            // PURGE MEDIA FILES (One-time migration enforcement)
            console.log('[Store] Enforcing Media File Purge on Load');
            const mediaFiles: any[] = [];

            // Restaurar transiciones globales (validando valores para tolerar datos antiguos/corruptos)
            const validTransitions = ['fade', 'slide', 'zoom'] as const;
            const globalTransitionType = validTransitions.includes(data.globalTransitionType)
                ? data.globalTransitionType
                : currentState.globalTransitionType;
            const globalTransitionSpeed = typeof data.globalTransitionSpeed === 'number' && data.globalTransitionSpeed >= 0
                ? data.globalTransitionSpeed
                : currentState.globalTransitionSpeed;

            set({
                isLoaded: true, // MARK ENABLED
                songs: data.songs || [],
                songFolders, // Use migrated folders
                // Force empty mediaFiles as requested
                mediaFiles,
                mediaFolders, // Use migrated folders
                expandedFolderIds: data.expandedFolderIds || ['general-media'], // Restore or default
                bibleState: data.bibleState || currentState.bibleState,
                songsState: data.songsState || currentState.songsState,
                activeTab: data.activeTab || 'songs',
                contentSource: data.contentSource || 'songs',
                globalTransitionType,
                globalTransitionSpeed,
                // FORCE RESET: Prevent ghost state on button
                activeMediaSnapshot: null,
                mediaLayerVisible: false
            });
            console.log('[Store] Store successfully hydrated and unlocked.');

            // Save migration immediately (también normaliza el archivo a la whitelist)
            scheduleSave();
            void flushSave();
        } else {
            console.log('[Store] No data found (or load failed). Initializing defaults and unlocking.');
            set({ isLoaded: true });
        }
    },

    resetData: () => {
        localStorage.removeItem(STORAGE_KEY);
        commit({
            songs: [],
            selectedSongId: null,
            songFolders: [
                { id: 'general-songs', name: 'General', isSystemFolder: true },
                { id: 'folder-1', name: 'Alabanza' },
                { id: 'folder-2', name: 'Adoración' }
            ],
            mediaFiles: [],
            mediaFolders: [
                { id: 'general-media', name: 'General', isSystemFolder: true },
                { id: 'folder-1', name: 'Fondos de Alabanza' },
                { id: 'folder-2', name: 'Fondos de Adoración' }
            ],
            activeMediaSnapshot: null,
            activeSlide: null,
            activeSlideIndex: -1,
        });
        console.log('App data reset complete');
    },



    activeTab: 'songs',
    contentSource: 'songs', // Default to songs

    // ... (rest of initial state)

    setActiveTab: (tab) => {
        commit((state) => ({
            activeTab: tab,
            // Update contentSource only if tab is 'songs' or 'bible'
            contentSource: (tab === 'songs' || tab === 'bible') ? tab : state.contentSource,
            // Limpiar la selección de slides al cambiar de pestaña para evitar que se mezclen
            selectedSlideIds: [],
            editingSlideId: null
        }));
    },

    // Guardado inmediato (omite el debounce). Persiste solo la whitelist PERSISTED_KEYS.
    saveToStorage: () => {
        scheduleSave();
        void flushSave();
    }
}));

// Auto-load on initialization
if (typeof window !== 'undefined') {
    useStore.getState().loadFromStorage().catch(console.error);

    // FLUSH BEFORE CLOSE: main.cjs pide guardar al cerrar la ventana de control;
    // escribimos los cambios pendientes (debounce) y confirmamos para que pueda cerrar.
    window.electronAPI?.onFlushRequest?.(async () => {
        try {
            await flushSave();
        } catch (err) {
            console.error('[Store] Flush before close failed:', err);
        } finally {
            window.electronAPI?.flushDone?.();
        }
    });
}
