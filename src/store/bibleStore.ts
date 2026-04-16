import { create } from 'zustand';
import { useStore } from './useStore';
import { Slide } from '../types';

// Slug table must match bibleManager.cjs exactly
const SLUGS = [
    'genesis','exodo','levitico','numeros','deuteronomio',
    'josue','jueces','rut','1-samuel','2-samuel',
    '1-reyes','2-reyes','1-cronicas','2-cronicas','esdras',
    'nehemias','ester','job','salmos','proverbios',
    'eclesiastes','cantares','isaias','jeremias','lamentaciones',
    'ezequiel','daniel','oseas','joel','amos',
    'abdias','jonas','miqueas','nahum','habacuc',
    'sofonias','hageo','zacarias','malaquias',
    'mateo','marcos','lucas','juan','hechos',
    'romanos','1-corintios','2-corintios','galatas','efesios',
    'filipenses','colosenses','1-tesalonicenses','2-tesalonicenses','1-timoteo',
    '2-timoteo','tito','filemon','hebreos','santiago',
    '1-pedro','2-pedro','1-juan','2-juan','3-juan',
    'judas','apocalipsis'
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface Verse   { number: number; text: string; }
interface Chapter { number: number; verses: Verse[]; }
interface BookData { book: string; chapters: Chapter[]; }

export interface HistoryVerse {
    reference: string;     // e.g. "Génesis 1:1"
    version: string;       // e.g. "RVR1960"
    text: string;          // the verse text
    bookName: string;      
    bookIndex: number;
    chapter: number;
    verse: number;
    timestamp: number;
}

interface SearchResult {
    reference: string;
    text:      string;
    bookName:  string;
    bookIndex: number;
    chapter:   number;
    verse:     number;
}

interface BibleStoreState {
    isLoading:      boolean;
    error:          string | null;
    attemptedPath:  string | null;
    currentBookData: BookData | null;
    currentBookIndex: number | null;
    searchResults:  SearchResult[];
    recentVerses:   HistoryVerse[];

    loadBook:     (bookName: string, bookIndex: number, version: string, restoreChapter?: number) => Promise<void>;
    loadChapter:  (chapterNum: number) => void;
    searchVerses: (query: string, version: string) => Promise<void>;
    clearSearch:  () => void;
    addToHistory: (verse: Omit<HistoryVerse, 'timestamp'>) => void;
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useBibleStore = create<BibleStoreState>((set, get) => ({
    isLoading:       false,
    error:           null,
    attemptedPath:   null,
    currentBookData: null,
    currentBookIndex: null,
    searchResults:   [],
    recentVerses:    [],

    // ── Load full book ─────────────────────────────────────────────────────────
    loadBook: async (bookName, bookIndex, version, restoreChapter = 1) => {
        if (!window.electronAPI?.loadBibleChapter) {
            set({ error: 'API de Biblia no disponible.' });
            return;
        }

        const prefix = bookIndex.toString().padStart(2, '0');
        const slug   = SLUGS[bookIndex - 1] ?? `libro${bookIndex}`;
        const attemptedPath = `/biblia/${version}/${prefix}-${slug}.json`;

        set({ isLoading: true, error: null, attemptedPath, currentBookData: null, currentBookIndex: bookIndex });

        console.log(`[bibleStore] Cargando libro ${bookIndex}: ${bookName} (${version})`);

        try {
            const result = await window.electronAPI.loadBibleChapter({
                version,
                bookIndex,
                fullBook: true,
            });

            if (!result.success || !result.data) {
                const msg = result.error || 'Error desconocido del backend';
                console.error(`[bibleStore] Fallo: ${msg}`);
                set({ error: msg, isLoading: false });
                return;
            }

            const bookData = result.data as unknown as BookData;

            if (!bookData.chapters || bookData.chapters.length === 0) {
                console.warn(`[bibleStore] El libro "${bookName}" no tiene capítulos.`);
                set({
                    error: `El libro "${bookName}" no tiene capítulos. Ejecuta el script split_to_books.cjs`,
                    isLoading: false
                });
                return;
            }

            set({ currentBookData: bookData, isLoading: false, error: null });
            console.log(`[bibleStore] Libro cargado: ${bookData.book} — ${bookData.chapters.length} capítulos`);

            // Persist book selection
            useStore.getState().setBibleState({ book: bookName, version, chapter: restoreChapter.toString() });

            // Load the target chapter
            get().loadChapter(restoreChapter);

        } catch (err: any) {
            console.error('[bibleStore] Error fatal:', err);
            set({ error: `Error de sistema: ${err.message}`, isLoading: false });
        }
    },

    // ── Load / switch chapter (instant — book already in memory) ──────────────
    loadChapter: (chapterNum) => {
        const { currentBookData } = get();
        if (!currentBookData) {
            console.warn('[bibleStore] loadChapter() llamado sin libro cargado.');
            return;
        }

        const chapter = currentBookData.chapters.find(c => c.number === chapterNum);

        if (!chapter) {
            console.warn(`[bibleStore] Capítulo ${chapterNum} no encontrado en "${currentBookData.book}".`);
            useStore.setState({
                slides: [{
                    id:         `bible-empty-${chapterNum}`,
                    content:    `${currentBookData.book} ${chapterNum}\n\n[Capítulo no disponible]`,
                    fontFamily: 'Poppins',
                    fontSize:   48,
                    type:       'bible' as const,
                }]
            });
            useStore.getState().setBibleState({ chapter: chapterNum.toString() });
            return;
        }

        if (chapter.verses.length === 0) {
            console.warn(`[bibleStore] ⚠ Capítulo ${chapterNum} de "${currentBookData.book}" tiene 0 versículos.`);
        }

        const slides: Slide[] = chapter.verses.map(v => ({
            id:         `bible-${currentBookData.book}-${chapterNum}-v${v.number}`,
            content:    `${currentBookData.book} ${chapterNum}:${v.number}\n\n${v.text}`,
            fontFamily: 'Poppins',
            fontSize:   56,
            type:       'bible' as const,
        }));

        console.log(`[bibleStore] Capítulo ${chapterNum}: ${slides.length} diapositivas generadas.`);
        useStore.setState({ slides });
        useStore.getState().setBibleState({ chapter: chapterNum.toString() });
    },

    // ── Global Content Search (Entire Version) ─────────────────────────────────
    searchVerses: async (query, version) => {
        if (!query || query.length < 3) {
            set({ searchResults: [] });
            return;
        }

        if (!window.electronAPI?.searchBible) {
            console.error('[bibleStore] searchBible API no disponible');
            return;
        }

        set({ isLoading: true });

        try {
            const result = await window.electronAPI.searchBible({ version, query });

            if (result.success && result.results) {
                const results: SearchResult[] = result.results.map(r => ({
                    reference: r.reference,
                    text:      r.text,
                    bookName:  r.bookName,
                    bookIndex: r.bookIndex,
                    chapter:   r.chapter,
                    verse:     r.verse
                }));
                
                console.log(`[bibleStore] Global Search "${query}": ${results.length} resultados`);
                set({ searchResults: results, isLoading: false });
            } else {
                console.error('[bibleStore] Global Search Failed:', result.error);
                set({ searchResults: [], isLoading: false });
            }
        } catch (err) {
            console.error('[bibleStore] Global Search Error:', err);
            set({ searchResults: [], isLoading: false });
        }
    },

    clearSearch: () => set({ searchResults: [] }),

    addToHistory: (verse) => set((state) => {
        const newVerse: HistoryVerse = { ...verse, timestamp: Date.now() };
        // Remove duplicate if exists
        const filtered = state.recentVerses.filter(v => v.reference !== newVerse.reference || v.version !== newVerse.version);
        // Add to front, slice to max 15
        return { recentVerses: [newVerse, ...filtered].slice(0, 15) };
    }),
}));
