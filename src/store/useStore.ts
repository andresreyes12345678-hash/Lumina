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
        }
    };

    window.electronAPI.triggerSlide(payload);
};

// Persistence helpers
// Persistence helpers
const STORAGE_KEY = 'lumina-data';

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

const saveToLocalStorage = (data: any) => {
    // GUARD: Prevent saving if not loaded to avoid wiping DB with initial state
    if (!data.isLoaded) {
        console.warn('[Store] Save BLOCKED: Store not fully loaded yet.');
        return;
    }

    console.log('[Store] saveToLocalStorage triggered');
    const { isLoaded, ...payload } = data; // Don't save the internal flag

    // STRINGIFY ON FRONTEND to avoid Structured Clone Algorithm blocking
    let cleanPayloadStr;
    try {
        cleanPayloadStr = JSON.stringify(payload, null, 2);
    } catch (err) {
        console.error('[Store] CRITICAL: Data format error - Object not serializable:', err);
        return;
    }

    if (window.electronAPI?.saveData) {
        window.electronAPI.saveData(cleanPayloadStr)
            .then(() => console.log('[Store] Save to Electron acknowledged'))
            .catch((err: any) => console.error('[Store] Save failed:', err));
    } else {
        localStorage.setItem(STORAGE_KEY, cleanPayloadStr);
    }
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
    textLayerVisible: true,
    mediaLayerVisible: true,
    activeMediaSnapshot: null,
    
    // Default projection state. Wil be overridden if loaded from storage
    isProjectionActive: false,

    toggleProjection: () => {
        set((state) => {
            const newActive = !state.isProjectionActive;
            const newState = { isProjectionActive: newActive };
            
            // Notify Main Process to show or hide the projection window
            if (window.electronAPI && window.electronAPI.toggleProjection) {
                window.electronAPI.toggleProjection();
            }
            
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
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
        set((state) => {
            // Sanitize: ensure all fields are strings (persisted data may have undefined)
            const merged = { ...state.bibleState, ...updates };
            const newBibleState = {
                version:     merged.version     || 'rvr1960',
                book:        merged.book        || '',
                chapter:     merged.chapter     || '',
                lastVerse:   merged.lastVerse   || '',
                searchQuery: merged.searchQuery || '',
                customChapterStyles: merged.customChapterStyles || {},
            };
            const newState = { bibleState: newBibleState };
            
            // Skip intensive disk IO if the user is typing in the search bar
            const isOnlySearchQuery = Object.keys(updates).length === 1 && 'searchQuery' in updates;
            if (!isOnlySearchQuery) {
                saveToLocalStorage({ ...state, ...newState });
            }
            return newState;
        });
    },

    updateBibleSlides: (updates) => {
        set((state) => {
            const newSlides = state.slides.map(s => ({ ...s, ...updates }));
            
            const newBibleState = { ...state.bibleState };
            if (!newBibleState.customChapterStyles) newBibleState.customChapterStyles = {};
            
            const chapterKey = `${state.bibleState.book}-${state.bibleState.chapter}`;
            const currentStyles = newBibleState.customChapterStyles[chapterKey] || {};
            
            newBibleState.customChapterStyles[chapterKey] = {
                ...currentStyles,
                ...updates
            };
            
            const newState = { slides: newSlides, bibleState: newBibleState };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    // Songs State Persistence
    songsState: {
        searchQuery: '',
        expandedFolders: ['folder-1'] // Default expanded
    },

    setSongsState: (updates: Partial<Store['songsState']>) => {
        set((state) => {
            const newState = { songsState: { ...state.songsState, ...updates } };
            
            // Skip intensive disk IO if the user is typing in the search bar
            const isOnlySearchQuery = Object.keys(updates).length === 1 && 'searchQuery' in updates;
            if (!isOnlySearchQuery) {
                saveToLocalStorage({ ...state, ...newState });
            }
            return newState;
        });
    },

    // Song management
    addSong: (song) => {
        set((state) => {
            const newState = { songs: [...state.songs, song] };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    updateSong: (songId, updates) => {
        set((state) => {
            const newState = {
                songs: state.songs.map(song =>
                    song.id === songId
                        ? { ...song, ...updates, updatedAt: Date.now() }
                        : song
                )
            };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    deleteSong: (songId) => {
        set((state) => {
            const newState = {
                songs: state.songs.filter(s => s.id !== songId),
                selectedSongId: state.selectedSongId === songId ? null : state.selectedSongId
            };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    setSelectedSong: (songId) => {
        set({ selectedSongId: songId });
        set({ selectedSlideIds: [] });
    },

    // Song folder management
    addSongFolder: (folder) => {
        set((state) => {
            const newState = { songFolders: [...state.songFolders, folder] };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    updateSongFolder: (folderId, updates) => {
        set((state) => {
            const folder = state.songFolders.find(f => f.id === folderId);
            if (folder?.isSystemFolder) {
                console.warn('Cannot rename system folder:', folder.name);
                return {};
            }
            const newState = {
                songFolders: state.songFolders.map(f =>
                    f.id === folderId ? { ...f, ...updates } : f
                )
            };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    deleteSongFolder: (folderId) => {
        set((state) => {
            const folder = state.songFolders.find(f => f.id === folderId);
            if (folder?.isSystemFolder) {
                console.warn('Cannot delete system folder:', folder.name);
                return {};
            }
            const newState = {
                songFolders: state.songFolders.filter(f => f.id !== folderId),
                // Move songs to General folder
                songs: state.songs.map(s => s.folderId === folderId ? { ...s, folderId: 'general-songs' } : s)
            };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    // Media management
    addMediaFile: (file) => {
        set((state) => {
            const newState = { mediaFiles: [...state.mediaFiles, file] };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    updateMediaFile: (fileId, updates) => {
        set((state) => {
            const newState = {
                mediaFiles: state.mediaFiles.map(f =>
                    f.id === fileId ? { ...f, ...updates } : f
                )
            };
            saveToLocalStorage({ ...state, ...newState });

            // PERSISTENCE: Save to JSON DB via Electron
            if (window.electronAPI && window.electronAPI.updateMedia) {
                window.electronAPI.updateMedia(fileId, updates).catch(err =>
                    console.error('[Store] Failed to persist media update:', err)
                );
            }

            return newState;
        });
    },

    deleteMediaFile: (fileId) => {
        set((state) => {
            const newState = { mediaFiles: state.mediaFiles.filter(f => f.id !== fileId) };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    addMediaFolder: (folder) => {
        set((state) => {
            const newState = { mediaFolders: [...state.mediaFolders, folder] };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    updateMediaFolder: (folderId, updates) => {
        set((state) => {
            const folder = state.mediaFolders.find(f => f.id === folderId);
            if (folder?.isSystemFolder) {
                console.warn('Cannot rename system folder:', folder.name);
                return {};
            }
            const newState = {
                mediaFolders: state.mediaFolders.map(f =>
                    f.id === folderId ? { ...f, ...updates } : f
                )
            };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    deleteMediaFolder: (folderId) => {
        set((state) => {
            const folder = state.mediaFolders.find(f => f.id === folderId);
            if (folder?.isSystemFolder) {
                console.warn('Cannot delete system folder:', folder.name);
                return {};
            }
            const newState = {
                mediaFolders: state.mediaFolders.filter(f => f.id !== folderId),
                mediaFiles: state.mediaFiles.map(f =>
                    f.folderId === folderId ? { ...f, folderId: 'general-media' } : f
                )
            };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    toggleFolderExpansion: (folderId) => {
        set((state) => {
            const current = state.expandedFolderIds || [];
            const updated = current.includes(folderId)
                ? current.filter((id) => id !== folderId)
                : [...current, folderId];

            // Persist immediately as it's a UI preference
            saveToLocalStorage({ ...state, expandedFolderIds: updated });
            return { expandedFolderIds: updated };
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

        set({ songs: newSongs });
        saveToLocalStorage({ ...get(), songs: newSongs });
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

    nextSlide: () => {
        const { activeTab, slides, songs, selectedSongId, activeSlideIndex, contentSource } = get();

        // Determine effective mode (Bible vs Songs)
        // If we are in Media tab, we rely on contentSource to know what's under the hood
        const effectiveMode = (activeTab === 'media') ? contentSource : activeTab;

        // Mode 1: BIBLE
        if (effectiveMode === 'bible') {
            if (slides.length === 0) return;
            const nextIndex = activeSlideIndex < slides.length - 1 ? activeSlideIndex + 1 : activeSlideIndex;
            const nextSlide = slides[nextIndex];
            get().setActiveSlide(nextSlide, nextIndex);
            return;
        }

        // Mode 2: SONGS
        if (!selectedSongId) return;
        const currentSlides = songs.find(s => s.id === selectedSongId)?.slides || [];
        if (currentSlides.length === 0) return;

        const nextIndex = activeSlideIndex < currentSlides.length - 1 ? activeSlideIndex + 1 : activeSlideIndex;
        const nextSlide = currentSlides[nextIndex];

        get().setActiveSlide(nextSlide, nextIndex);
    },

    previousSlide: () => {
        const { activeTab, slides, songs, selectedSongId, activeSlideIndex, contentSource } = get();

        // Determine effective mode
        const effectiveMode = (activeTab === 'media') ? contentSource : activeTab;

        // Mode 1: BIBLE
        if (effectiveMode === 'bible') {
            if (slides.length === 0) return;
            const prevIndex = activeSlideIndex > 0 ? activeSlideIndex - 1 : 0;
            const prevSlide = slides[prevIndex];
            get().setActiveSlide(prevSlide, prevIndex);
            return;
        }

        // Mode 2: SONGS
        if (!selectedSongId) return;
        const currentSlides = songs.find(s => s.id === selectedSongId)?.slides || [];
        if (currentSlides.length === 0) return;

        const prevIndex = activeSlideIndex > 0 ? activeSlideIndex - 1 : 0;
        const prevSlide = currentSlides[prevIndex];

        get().setActiveSlide(prevSlide, prevIndex);
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

    blackout: () => {
        set({ textLayerVisible: false, mediaLayerVisible: false });
        if (window.electronAPI) {
            window.electronAPI.blackout();
        }
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
                // FORCE RESET: Prevent ghost state on button
                activeMediaSnapshot: null,
                mediaLayerVisible: false
            });
            console.log('[Store] Store successfully hydrated and unlocked.');

            // Save migration immediately
            saveToLocalStorage({
                ...data,
                mediaFolders,
                songFolders,
                mediaFiles: [],
                isLoaded: true
            });
        } else {
            console.log('[Store] No data found (or load failed). Initializing defaults and unlocking.');
            set({ isLoaded: true });
        }
    },

    resetData: () => {
        localStorage.removeItem(STORAGE_KEY);
        set({
            songs: [],
            selectedSongId: null,
            songFolders: [
                { id: 'folder-1', name: 'Alabanza' },
                { id: 'folder-2', name: 'Adoración' }
            ],
            mediaFiles: [],
            mediaFolders: [
                { id: 'default', name: 'Sin carpeta' },
                { id: 'folder-1', name: 'Fondos de Alabanza' },
                { id: 'folder-2', name: 'Fondos de Adoración' }
            ],
            activeMediaSnapshot: null
        });
        console.log('App data reset complete');
    },



    activeTab: 'songs',
    contentSource: 'songs', // Default to songs

    // ... (rest of initial state)

    setActiveTab: (tab) => {
        set((state) => {
            // Update contentSource only if tab is 'songs' or 'bible'
            const newContentSource = (tab === 'songs' || tab === 'bible')
                ? tab
                : state.contentSource;

            const newState = {
                activeTab: tab,
                contentSource: newContentSource
            };
            saveToLocalStorage({ ...state, ...newState });
            return newState;
        });
    },

    saveToStorage: () => {
        const state = get();
        saveToLocalStorage({
            songs: state.songs,
            songFolders: state.songFolders,
            // mediaFiles is excluded - managed by MediaManager (media-db.json)
            mediaFolders: state.mediaFolders,
            bibleState: state.bibleState,
            songsState: state.songsState,
            activeTab: state.activeTab,
            contentSource: state.contentSource,
            // Persistent background snapshot
            activeMediaSnapshot: state.activeMediaSnapshot
        });
    }
}));

// Auto-load on initialization
if (typeof window !== 'undefined') {
    useStore.getState().loadFromStorage().catch(console.error);
}
