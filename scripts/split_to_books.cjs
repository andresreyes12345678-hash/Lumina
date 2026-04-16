/**
 * split_to_books.cjs  v3.0
 * ───────────────────────────────────────────────────────────────
 * Reads the full Bible JSON (e.g. biblia/rvr1960/rvr1960.json)
 * and writes 66 individual book files using the clean schema:
 *
 *   { "book": "Génesis", "chapters": [ { "number": 1, "verses": [ { "number": 1, "text": "..." } ] } ] }
 *
 * Usage:
 *   node scripts/split_to_books.cjs [version_folder]
 *   node scripts/split_to_books.cjs                   ← processes ALL version folders
 *
 * Example:
 *   node scripts/split_to_books.cjs rvr1960
 * ───────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────────────────────────

const BIBLE_DIR = path.join(__dirname, '..', 'biblia');

// Canonical Spanish book names (index 0 = Genesis, 65 = Apocalipsis)
// These override the name from the JSON if present.
const BOOK_NAMES = [
    'Génesis','Éxodo','Levítico','Números','Deuteronomio',
    'Josué','Jueces','Rut','1 Samuel','2 Samuel',
    '1 Reyes','2 Reyes','1 Crónicas','2 Crónicas','Esdras',
    'Nehemías','Ester','Job','Salmos','Proverbios',
    'Eclesiastés','Cantares','Isaías','Jeremías','Lamentaciones',
    'Ezequiel','Daniel','Oseas','Joel','Amós',
    'Abdías','Jonás','Miqueas','Nahúm','Habacuc',
    'Sofonías','Hageo','Zacarías','Malaquías',
    'Mateo','Marcos','Lucas','Juan','Hechos',
    'Romanos','1 Corintios','2 Corintios','Gálatas','Efesios',
    'Filipenses','Colosenses','1 Tesalonicenses','2 Tesalonicenses','1 Timoteo',
    '2 Timoteo','Tito','Filemón','Hebreos','Santiago',
    '1 Pedro','2 Pedro','1 Juan','2 Juan','3 Juan',
    'Judas','Apocalipsis'
];

// URL-safe slug for file names (no accents, no spaces)
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

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract chapter number from chapter_usfm string.
 * "GEN.1" → 1,  "GEN.INTRO1" → null
 */
function parseChapterNum(chapter) {
    const usfm = chapter.chapter_usfm || '';
    const match = usfm.match(/\.(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract clean text from a verse item.
 * Handles lines[], text, and content fields.
 */
function extractText(item) {
    if (Array.isArray(item.lines) && item.lines.length > 0) {
        return item.lines.join(' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
    const raw = item.text || item.content || '';
    return raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ── Core Processing ────────────────────────────────────────────────────────────

function processVersion(versionFolder) {
    const versionDir = path.join(BIBLE_DIR, versionFolder);

    // Find the full Bible JSON — convention: same name as folder
    const candidates = [
        path.join(versionDir, `${versionFolder}.json`),
        // Fallback: any large JSON in the folder
    ];

    let sourcePath = null;
    for (const c of candidates) {
        if (fs.existsSync(c)) { sourcePath = c; break; }
    }

    // If not found by convention, look for any .json file >= 1 MB with "books" key
    if (!sourcePath) {
        const files = fs.readdirSync(versionDir).filter(f => f.endsWith('.json'));
        for (const f of files) {
            const fp = path.join(versionDir, f);
            const stat = fs.statSync(fp);
            if (stat.size > 1_000_000) { sourcePath = fp; break; }
        }
    }

    if (!sourcePath) {
        console.error(`[✗] No se encontró el archivo fuente en ${versionDir}`);
        return;
    }

    console.log(`\n[→] Procesando versión: ${versionFolder}`);
    console.log(`    Fuente: ${path.basename(sourcePath)} (${(fs.statSync(sourcePath).size / 1024 / 1024).toFixed(1)} MB)`);

    const raw  = fs.readFileSync(sourcePath, 'utf8');
    const data = JSON.parse(raw);

    if (!data.books || !Array.isArray(data.books)) {
        console.error(`[✗] El JSON no tiene un array "books" válido.`);
        return;
    }

    let totalBooks = 0;
    let totalVerses = 0;
    const errors = [];

    data.books.forEach((srcBook, bookIdx) => {
        const bookNumber  = bookIdx + 1;                              // 1-based
        const bookName    = BOOK_NAMES[bookIdx] || srcBook.name || `Libro${bookNumber}`;
        const slug        = SLUGS[bookIdx] || `libro${bookNumber}`;
        const prefix      = bookNumber.toString().padStart(2, '0');   // "01", "02", …
        const fileName    = `${prefix}-${slug}.json`;
        const outputPath  = path.join(versionDir, fileName);

        // Build clean chapter array
        const chaptersOut = [];

        for (const srcChapter of (srcBook.chapters || [])) {
            const chNum = parseChapterNum(srcChapter);

            // Skip non-chapter entries (intros, appendices)
            if (chNum === null) continue;

            const versesOut = [];

            for (const item of (srcChapter.items || [])) {
                if (item.type !== 'verse') continue;

                const verseNum = (Array.isArray(item.verse_numbers) && item.verse_numbers[0])
                    || item.number
                    || (versesOut.length + 1);

                const text = extractText(item);
                if (!text) continue;

                versesOut.push({ number: verseNum, text });
            }

            if (versesOut.length === 0) {
                errors.push(`  [!] ${bookName} capítulo ${chNum}: 0 versículos extraídos`);
            }

            // ── CRITICAL: start from index 0, never skip chapter 1 ──────────
            chaptersOut.push({ number: chNum, verses: versesOut });
        }

        // Sort chapters numerically (just in case source is unordered)
        chaptersOut.sort((a, b) => a.number - b.number);

        const output = {
            book:     bookName,
            chapters: chaptersOut
        };

        fs.writeFileSync(outputPath, JSON.stringify(output), 'utf8');

        const verseCount = chaptersOut.reduce((s, c) => s + c.verses.length, 0);
        totalVerses += verseCount;
        totalBooks++;

        console.log(`    [${bookNumber.toString().padStart(2)}] ${bookName.padEnd(20)} → ${fileName}  (${chaptersOut.length} cap, ${verseCount} vers)`);
    });

    errors.forEach(e => console.warn(e));
    console.log(`\n[✓] ${versionFolder}: ${totalBooks} libros, ${totalVerses.toLocaleString()} versículos totales.`);
}

// ── Entry Point ────────────────────────────────────────────────────────────────

const arg = process.argv[2];

if (arg) {
    // Single version
    processVersion(arg);
} else {
    // All version folders inside /biblia
    if (!fs.existsSync(BIBLE_DIR)) {
        console.error(`[✗] Carpeta no encontrada: ${BIBLE_DIR}`);
        process.exit(1);
    }
    const versions = fs.readdirSync(BIBLE_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);

    if (versions.length === 0) {
        console.error('[✗] No se encontraron carpetas de versiones en /biblia');
        process.exit(1);
    }

    versions.forEach(processVersion);
}

console.log('\n[✓] Proceso completado.\n');
