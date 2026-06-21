import React from 'react';
import { Search, Book as BookIcon, Loader2, AlertCircle, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { BIBLE_BOOKS, VERSIONS } from '../../constants/bible';
import { useBibleStore } from '../../store/bibleStore';

// ── Component ──────────────────────────────────────────────────────────────────

const BiblePanel: React.FC = () => {
    const { bibleState, setBibleState } = useStore();
    const {
        version,
        book:    selectedBook,
        chapter: selectedChapter,
    } = bibleState;

    // Guard: persisted state may have undefined values
    const safeVersion  = version  || 'rvr1960';
    const safeBook     = selectedBook  || '';
    const safeChapter  = selectedChapter  || '1';

    const {
        loadBook, loadChapter,
        searchVerses, clearSearch,
        searchResults,
        isLoading, error, attemptedPath,
        currentBookData,
    } = useBibleStore();

    // ── Local search query (not persisted globally — it's transient) ───────────
    const [searchQuery, setSearchQuery] = React.useState('');

    // Accent-insensitive, case-insensitive normalize — safe with undefined
    const normalize = (s: string | null | undefined): string => {
        if (!s || typeof s !== 'string') return '';
        return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    // Chapter count: prefer live data, fall back to static constant
    const chaptersCount = currentBookData?.chapters?.length
        ?? BIBLE_BOOKS.find(b => b.name === safeBook)?.chapters
        ?? 0;
    const chaptersList = chaptersCount > 0
        ? (currentBookData?.chapters?.map(c => c.number)
            ?? Array.from({ length: chaptersCount }, (_, i) => i + 1))
        : [];

    const showSearch     = searchQuery.length >= 3;
    const isBookLoaded   = currentBookData !== null;
    const [isSearching, setIsSearching] = React.useState(false);

    // Books list filtered: only active when NOT in global search mode
    const filteredBooks = React.useMemo(() => {
        if (showSearch) return BIBLE_BOOKS;   // never filter by name during global search
        if (!searchQuery) return BIBLE_BOOKS;
        const q = normalize(searchQuery);
        if (!q) return BIBLE_BOOKS;
        return BIBLE_BOOKS.filter(b => normalize(b.name).includes(q));
    }, [searchQuery, showSearch]);

    // ── Debounce Search ──────────────────────────────────────────────
    React.useEffect(() => {
        if (!showSearch) {
            setIsSearching(false);
            clearSearch();
            return;
        }
        setIsSearching(true);
        const timer = setTimeout(async () => {
            await searchVerses(searchQuery, safeVersion);
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, safeVersion, showSearch]);

    // ── Auto-restore on mount ──────────────────────────────────────────────────
    const didMount = React.useRef(false);
    React.useEffect(() => {
        if (didMount.current) return;
        didMount.current = true;
        // Auto-restore: load the last selected book if one is persisted
        if (safeBook) {
            const bookData = BIBLE_BOOKS.find(b => b.name === safeBook);
            if (bookData) {
                const ch = parseInt(safeChapter) || 1;
                loadBook(safeBook, bookData.index, safeVersion, ch);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Handlers ───────────────────────────────────────────────────────────────

    const handleSelectBook = (bookName: string, bookIndex: number) => {
        clearSearch();
        setSearchQuery('');
        loadBook(bookName, bookIndex, safeVersion, 1);
    };

    const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value;
        setBibleState({ version: v });
        if (safeBook) {
            const bookData = BIBLE_BOOKS.find(b => b.name === safeBook);
            if (bookData) loadBook(safeBook, bookData.index, v, parseInt(safeChapter) || 1);
        }
    };

    const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const ch = parseInt(e.target.value);
        if (!ch) return;
        if (isBookLoaded) {
            loadChapter(ch);
        } else if (safeBook) {
            const bookData = BIBLE_BOOKS.find(b => b.name === safeBook);
            if (bookData) loadBook(safeBook, bookData.index, safeVersion, ch);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        clearSearch();
    };

    const handleSearchResultClick = async (result: { bookName: string; bookIndex: number; chapter: number; verse: number }) => {
        // 1. Load the book + chapter (generates slides in the grid)
        await loadBook(result.bookName, result.bookIndex, safeVersion, result.chapter);
        
        // 2. Clear search UI
        setSearchQuery('');
        clearSearch();

        // 3. Auto-project: Find the specific verse slide and project it immediately
        // Use a microtask to ensure the store has flushed the new slides
        requestAnimationFrame(() => {
            const { slides, setActiveSlide, setSlideSelection } = useStore.getState();
            const targetSlideId = `bible-${result.bookName}-${result.chapter}-v${result.verse}`;
            const verseIndex = slides.findIndex(s => s.id === targetSlideId);
            
            if (verseIndex !== -1) {
                const verseSlide = slides[verseIndex];
                setActiveSlide(verseSlide, verseIndex);
                setSlideSelection([verseSlide.id]);
                console.log(`[BiblePanel] Auto-projected: ${result.bookName} ${result.chapter}:${result.verse}`);
            } else {
                // Fallback: project first slide if specific verse not found
                if (slides.length > 0) {
                    setActiveSlide(slides[0], 0);
                    setSlideSelection([slides[0].id]);
                }
                console.warn(`[BiblePanel] Verse slide not found: ${targetSlideId}, projected first slide`);
            }
        });
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="h-full flex flex-col p-3 gap-3 select-none">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2">
                <BookIcon size={14} className="text-blue-400 flex-shrink-0" />
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Biblia</h3>
            </div>

            {/* ── Selectors ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">

                {/* Version + Chapter */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1">Versión</label>
                        <select
                            value={safeVersion}
                            onChange={handleVersionChange}
                            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 focus:ring-1 focus:ring-blue-500"
                        >
                            {VERSIONS.map(v => (
                                <option key={v.folder} value={v.folder}>{v.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1">
                            Capítulo {chaptersCount > 0 && <span className="text-gray-600 normal-case">({chaptersCount})</span>}
                        </label>
                        <select
                            value={selectedChapter}
                            onChange={handleChapterChange}
                            disabled={!selectedBook || isLoading}
                            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 focus:ring-1 focus:ring-blue-500 disabled:opacity-30"
                        >
                            <option value="">Cap.</option>
                            {chaptersList.map(ch => (
                                <option key={ch} value={ch}>{ch}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Book dropdown */}
                <div>
                    <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1">Libro</label>
                    <select
                        value={selectedBook}
                        onChange={e => {
                            const book = BIBLE_BOOKS.find(b => b.name === e.target.value);
                            if (book) handleSelectBook(book.name, book.index);
                        }}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="">— Selecciona un libro —</option>
                        {BIBLE_BOOKS.map(b => (
                            <option key={b.index} value={b.name}>{b.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Search ─────────────────────────────────────────────────── */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={13} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Buscar palabra, frase o versículo..."
                    className="w-full pl-8 pr-7 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                {searchQuery && (
                    <button
                        onClick={handleClearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* ── Error ──────────────────────────────────────────────────── */}
            {error && (
                <div className="flex gap-2 p-2 bg-red-900/20 border border-red-800 rounded text-[10px] text-red-300">
                    <AlertCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="font-bold mb-0.5">Error al cargar</p>
                        {attemptedPath && (
                            <code className="block break-all bg-black/30 px-1 py-0.5 rounded text-red-400 mb-0.5">
                                {attemptedPath}
                            </code>
                        )}
                        <p className="text-red-400/70 italic">{error}</p>
                    </div>
                </div>
            )}

            {/* ── Main list ──────────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto">

                {/* Book-load spinner - only when actually loading a book, not during search */}
                {isLoading && !showSearch ? (
                    <div className="flex items-center justify-center gap-2 h-20 text-gray-500">
                        <Loader2 size={16} className="animate-spin text-blue-400" />
                        <span className="text-xs">Cargando…</span>
                    </div>

                ) : showSearch ? (
                    /* ── Search results ───────────────────────────────────── */
                    <div className="space-y-1.5">
                        <p className="text-[9px] text-gray-500 uppercase font-bold px-1 mb-2 flex items-center gap-1.5">
                            {isSearching && <Loader2 size={9} className="animate-spin" />}
                            {isSearching
                                ? 'Buscando en toda la Biblia...'
                                : searchResults.length > 0
                                    ? `${searchResults.length} resultados en ${safeVersion.toUpperCase()}`
                                    : `Sin resultados para «${searchQuery}»`}
                        </p>

                        {searchResults.map((r, i) => {
                            const highlightMatch = (text: string, query: string) => {
                                if (!query) return <span>{text}</span>;
                                const nText = normalize(text);
                                const nQuery = normalize(query);
                                const parts = [];
                                let currentIndex = 0;
                                
                                while (currentIndex < text.length) {
                                    const matchIndex = nText.indexOf(nQuery, currentIndex);
                                    if (matchIndex === -1) {
                                        parts.push(<span key={currentIndex}>{text.slice(currentIndex)}</span>);
                                        break;
                                    }
                                    if (matchIndex > currentIndex) {
                                        parts.push(<span key={currentIndex}>{text.slice(currentIndex, matchIndex)}</span>);
                                    }
                                    parts.push(
                                        <mark key={`mark-${matchIndex}`} className="bg-yellow-500/30 text-yellow-200 rounded-sm">
                                            {text.slice(matchIndex, matchIndex + query.length)}
                                        </mark>
                                    );
                                    currentIndex = matchIndex + query.length;
                                }
                                return parts;
                            };

                            return (
                                <div
                                    key={i}
                                    onClick={() => handleSearchResultClick(r)}
                                    className="px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded cursor-pointer hover:border-blue-500 hover:bg-gray-800 transition-all"
                                >
                                    <p className="text-[10px] font-bold text-blue-400 mb-1">{r.reference}</p>
                                    <p className="text-[11px] text-gray-300 leading-snug line-clamp-3">
                                        {highlightMatch(r.text, searchQuery)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                ) : (
                    /* ── Book list ────────────────────────────────────────── */
                    <div className="space-y-px">
                        {filteredBooks.map(book => (
                            <button
                                key={book.index}
                                onClick={() => handleSelectBook(book.name, book.index)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded text-left transition-all duration-100 ${
                                    selectedBook === book.name
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                                }`}
                            >
                                <span className="text-[12px] font-medium truncate">{book.name}</span>
                                <span className={`text-[9px] flex-shrink-0 ml-2 tabular-nums ${
                                    selectedBook === book.name ? 'text-blue-200' : 'text-gray-600'
                                }`}>
                                    {book.chapters}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Status bar ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-[10px]">
                <span className="text-gray-500 truncate">
                    {currentBookData
                        ? `${currentBookData.book} ${selectedChapter || '1'}`
                        : selectedBook || 'Sin selección'}
                </span>
                <span className="text-blue-500 font-bold uppercase tracking-wider flex-shrink-0 ml-2">
                    {version}
                </span>
            </div>
        </div>
    );
};

export default BiblePanel;
