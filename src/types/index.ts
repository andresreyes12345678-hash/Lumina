// Slide types for different sections
export type SlideType =
    | 'verso1' | 'verso2' | 'verso3'
    | 'coro1' | 'coro2' | 'coro3'
    | 'puente1' | 'puente2'
    | 'intro' | 'final' | 'bible';

// Main slide interface
export interface Slide {
    id: string;
    content: string;
    type?: SlideType;
    backgroundColor?: string;
    backgroundMedia?: string;
    backgroundMediaType?: 'image' | 'video';
    backgroundScaling?: 'contain' | 'cover' | 'fill'; // Control aspect ratio
    backgroundTimestamp?: number; // Added for decoupling
    fontFamily?: string;
    fontSize?: number;
    // Persistent video settings
    isLooping?: boolean; // New property for Loop behavior
    // Runtime video control state (optional, for live playback payload)
    videoControl?: {
        isPlaying: boolean;
        isLooping: boolean;
        volume: number; // 0-1
        seekTime?: number; // timestamp to seek to
        timestamp?: number; // to force updates
        duration?: number;
        currentTime?: number;
    };
}

// Song interface for organizing slides
export interface Song {
    id: string;
    title: string;
    folderId: string;
    artist?: string;
    slides: Slide[];
    createdAt: number;
    updatedAt: number;
}

// Folder for organizing songs
export interface SongFolder {
    id: string;
    name: string;
    isSystemFolder?: boolean;
}

// Media folder
export interface MediaFolder {
    id: string;
    name: string;
    isSystemFolder?: boolean;
}

// Media file
export interface MediaFile {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'video';
    scaling?: 'contain' | 'cover' | 'fill'; // Preference for this file
    thumbnailUrl?: string; // Generated thumbnail for videos
    folderId: string;
    isLooping?: boolean; // Persistent loop preference for this file
}

// Hotkey mapping for quick access
export interface HotkeyMap {
    [key: string]: SlideType;
}

// Type colors for visual distinction
export const TYPE_COLORS: Record<SlideType, string> = {
    verso1: 'border-blue-500 bg-blue-500/10',
    verso2: 'border-blue-500 bg-blue-500/10',
    verso3: 'border-blue-500 bg-blue-500/10',
    coro1: 'border-red-500 bg-red-500/10',
    coro2: 'border-red-500 bg-red-500/10',
    coro3: 'border-red-500 bg-red-500/10',
    puente1: 'border-green-500 bg-green-500/10',
    puente2: 'border-green-500 bg-green-500/10',
    intro: 'border-yellow-500 bg-yellow-500/10',
    final: 'border-yellow-500 bg-yellow-500/10',
    bible: 'border-cyan-500 bg-cyan-500/10'
};

// Hotkey assignments
export const HOTKEY_MAP: Record<string, SlideType> = {
    'a': 'verso1',
    's': 'verso2',
    'd': 'verso3',
    'c': 'coro1',
    'x': 'coro2',
    'z': 'coro3',
    'b': 'puente1',
    'n': 'puente2',
    'i': 'intro',
    'e': 'final',
};

// Reverse lookup for displaying hotkeys
export const TYPE_HOTKEYS: Record<SlideType, string> = {
    verso1: 'A',
    verso2: 'S',
    verso3: 'D',
    coro1: 'C',
    coro2: 'X',
    coro3: 'Z',
    puente1: 'B',
    puente2: 'N',
    intro: 'I',
    final: 'E',
    bible: '',
};

// Type labels in Spanish
export const TYPE_LABELS: Record<SlideType, string> = {
    verso1: 'Verso 1',
    verso2: 'Verso 2',
    verso3: 'Verso 3',
    coro1: 'Coro 1',
    coro2: 'Coro 2',
    coro3: 'Coro 3',
    puente1: 'Puente 1',
    puente2: 'Puente 2',
    intro: 'Intro',
    final: 'Final',
    bible: 'Biblia'
};

// Electron API interface
export interface ElectronAPI {
    triggerSlide: (slide: Slide | null) => void;
    blackout: () => void;
    onUpdateStage: (callback: (slide: Slide | null) => void) => () => void;
    onUpdatePreview: (callback: (slide: Slide | null) => void) => () => void;
    getFilePath: (file: File) => string;
    // Media Manager
    importMedia?: (paths: string[]) => Promise<any>;
    getMediaLibrary?: () => Promise<any[]>;
    deleteMedia?: (id: string) => Promise<{ success: boolean; error?: string }>;
    updateMedia?: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
    on?: (channel: string, callback: (...args: any[]) => void) => () => void;

    // Video Sync
    sendVideoControl?: (control: { action: 'play' | 'pause' | 'seek' | 'loop', time?: number, value?: boolean }) => void;
    onVideoControl?: (callback: (control: { action: 'play' | 'pause' | 'seek' | 'loop', time?: number, value?: boolean }) => void) => () => void;
    sendVideoEnded?: () => void;
    onVideoEnded: (callback: () => void) => () => void;
    // Dedicated volume channel (Stage only — no IPC feedback loop)
    sendVideoVolume?: (volume: number) => void;
    onVideoVolume?: (callback: (data: { volume: number }) => void) => () => void;
    // Data Persistence
    loadData: () => Promise<any>;
    saveData: (data: any) => Promise<{ success: boolean; error?: string }>;
    // Bible Manager
    loadBibleChapter: (params: { 
        version: string; 
        bookIndex: number; 
        bookName?: string; 
        chapter?: number;
        fullBook?: boolean;
    }) => Promise<{ 
        success: boolean; 
        data?: { 
            // New clean format
            book?: string;
            chapters?: { number: number; verses: { number: number; text: string }[] }[];
            // Legacy single-chapter format
            bookName?: string; 
            chapter?: number; 
            totalChapters?: number;
            verses?: { number: number; text: string }[];
        }; 
        error?: string; 
    }>;
    searchBible: (params: { version: string; query: string }) => Promise<{ 
        success: boolean; 
        results?: { 
            bookName: string;
            bookIndex: number;
            chapter: number; 
            verse: number;
            text: string;
            reference: string;
        }[]; 
        error?: string; 
    }>;
    getBibleVersions: () => Promise<{ success: boolean; versions?: string[]; error?: string }>;

    // NDI & Window Control
    toggleProjection: () => void;
    requestCurrentState: () => void;
    onGetCurrentState: (callback: () => void) => () => void;
    toggleNdi: (active: boolean) => void;
    getNdiStatus: () => Promise<{ installed: boolean; active: boolean }>;
    notifyNdiAnimation: (isAnimating: boolean) => void;
}

// Extend Window interface for TypeScript
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
