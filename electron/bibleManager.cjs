/**
 * bibleManager.cjs — v3.0
 * Reads clean book files: { book, chapters: [{number, verses:[{number,text}]}] }
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { ipcMain, app } = require('electron');

// ── Path resolution ────────────────────────────────────────────────────────────

const getBibleBasePath = () => {
    const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;
    return isDev
        ? path.join(process.cwd(), 'biblia')
        : path.join(process.resourcesPath, 'biblia');
};

// Slug table: bookIndex (1-based) → file slug
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

function getBookFilePath(basePath, version, bookIndex) {
    const prefix = bookIndex.toString().padStart(2, '0');
    const slug   = SLUGS[bookIndex - 1] || `libro${bookIndex}`;
    return path.join(basePath, version, `${prefix}-${slug}.json`);
}

// ── Cache ──────────────────────────────────────────────────────────────────────

const bookCache = new Map();
const MAX_CACHE = 8;

function cacheSet(key, data) {
    if (bookCache.size >= MAX_CACHE) {
        bookCache.delete(bookCache.keys().next().value);
    }
    bookCache.set(key, data);
}

// ── Core loader ────────────────────────────────────────────────────────────────

/**
 * Load a book file and return its data.
 * @param {string} version  - e.g. "rvr1960"
 * @param {number} bookIndex - 1-based index (1 = Génesis)
 * @returns {{ book: string, chapters: [{number, verses:[{number,text}]}] }}
 */
function loadBook(version, bookIndex) {
    const cacheKey = `${version}:${bookIndex}`;
    if (bookCache.has(cacheKey)) return bookCache.get(cacheKey);

    const basePath = getBibleBasePath();
    const filePath = getBookFilePath(basePath, version, bookIndex);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
    }

    let bookData;
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        bookData  = JSON.parse(raw);
    } catch (err) {
        throw new Error(`JSON inválido en ${filePath}: ${err.message}`);
    }

    if (!bookData.book || !Array.isArray(bookData.chapters)) {
        throw new Error(`Formato inesperado en ${filePath}. Ejecuta split_to_books.cjs`);
    }

    cacheSet(cacheKey, bookData);
    return bookData;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function getVersionList() {
    const base = getBibleBasePath();
    if (!fs.existsSync(base)) return [];
    try {
        return fs.readdirSync(base, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => e.name);
    } catch {
        return [];
    }
}

// ── IPC Handlers ───────────────────────────────────────────────────────────────

function initialize() {
    console.log(`[BibleManager v3] Base: ${getBibleBasePath()}`);
}

function registerHandlers() {
    // Load whole book (fullBook=true) or a single chapter
    ipcMain.handle('bible:load-chapter', (event, { version, bookIndex, chapter, fullBook }) => {
        try {
            const bookData = loadBook(version, bookIndex);

            if (fullBook) {
                return { success: true, data: bookData };
            }

            // Single-chapter extraction (legacy support)
            const chapterData = bookData.chapters.find(c => c.number === chapter);
            if (!chapterData) {
                return { success: false, error: `Capítulo ${chapter} no encontrado en ${bookData.book}` };
            }

            return {
                success: true,
                data: {
                    book:    bookData.book,
                    chapter: chapter,
                    totalChapters: bookData.chapters.length,
                    verses:  chapterData.verses
                }
            };
        } catch (err) {
            console.error('[BibleManager] Error:', err.message);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('bible:get-versions', () => {
        try {
            return { success: true, versions: getVersionList() };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Global Content Search (all 66 books)
    ipcMain.handle('bible:search', async (event, { version, query }) => {
        if (!query || query.length < 3) return { success: true, results: [] };

        try {
            const basePath = getBibleBasePath();
            const versionDir = path.join(basePath, version);

            if (!fs.existsSync(versionDir)) {
                return { success: false, error: `Versión no encontrada: ${version}` };
            }

            // Accent-insensitive, case-insensitive helper
            const normalize = (s) =>
                s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

            const q = normalize(query);
            const results = [];

            // Only match clean split files: NN-slug.json (hyphens only, no underscores)
            // Pattern: two digits, hyphen, then only lowercase letters and hyphens
            const files = fs.readdirSync(versionDir)
                .filter(f => /^\d{2}-[a-z][a-z0-9-]*\.json$/.test(f))
                .sort();

            for (const file of files) {
                let bookData;
                try {
                    bookData = JSON.parse(fs.readFileSync(path.join(versionDir, file), 'utf8'));
                } catch {
                    console.warn(`[BibleManager:search] Skip corrupt file: ${file}`);
                    continue;
                }

                if (!bookData.book || !Array.isArray(bookData.chapters)) continue;

                for (const ch of bookData.chapters) {
                    if (!ch || !Array.isArray(ch.verses)) continue;
                    for (const v of ch.verses) {
                        if (!v || !v.text) continue;
                        if (normalize(v.text).includes(q)) {
                            results.push({
                                bookName:  bookData.book,
                                bookIndex: parseInt(file.split('-')[0], 10),
                                chapter:   ch.number,
                                verse:     v.number,
                                text:      v.text,
                                reference: `${bookData.book} ${ch.number}:${v.number}`
                            });
                        }
                    }
                }
                if (results.length > 500) break;
            }

            return { success: true, results };
        } catch (err) {
            console.error('[BibleManager] Search Error:', err);
            return { success: false, error: err.message };
        }
    });

    console.log('[BibleManager v3] Handlers registered.');
}

module.exports = { initialize, registerHandlers };
