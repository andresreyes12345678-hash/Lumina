/**
 * check_bibles.js — Script de auditoría de integridad para bases de datos de la Biblia (JSON).
 * 
 * Uso: node scripts/check_bibles.js
 */

const fs = require('fs');
const path = require('path');

const BIBLE_PATH = path.join(__dirname, '..', 'biblia');
const VERSIONS = ['rvr1960', 'ntv', 'rvr2015'];
const EXPECTED_BOOKS = 66;

console.log('=== AUDITORÍA DE INTEGRIDAD BÍBLICA ===');
console.log(`Ruta base: ${BIBLE_PATH}`);

if (!fs.existsSync(BIBLE_PATH)) {
    console.error('❌ Error: El directorio "biblia" no existe en la raíz del proyecto.');
    process.exit(1);
}

const audit = {
    versions: {},
    totalErrors: 0
};

VERSIONS.forEach(version => {
    console.log(`\n--- Analizando versión: ${version.toUpperCase()} ---`);
    const versionPath = path.join(BIBLE_PATH, version);

    if (!fs.existsSync(versionPath)) {
        console.error(`❌ Carpeta no encontrada para la versión ${version}`);
        audit.totalErrors++;
        return;
    }

    const files = fs.readdirSync(versionPath).filter(f => f.endsWith('.json'));
    const stats = {
        count: files.length,
        emptyFiles: [],
        malformedJson: [],
        missingVerses: [],
        validBooks: 0
    };

    if (files.length < EXPECTED_BOOKS) {
        console.warn(`⚠️ Faltan libros. Encontrados: ${files.length}/66`);
    }

    files.forEach(file => {
        const filePath = path.join(versionPath, file);
        const fileStats = fs.statSync(filePath);

        // Check 1: Size
        if (fileStats.size === 0) {
            stats.emptyFiles.push(file);
            return;
        }

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(raw);

            // Check 2: Structure & Verses
            let verseCount = 0;
            if (data.chapters && Array.isArray(data.chapters)) {
                data.chapters.forEach(ch => {
                    if (ch.items && Array.isArray(ch.items)) {
                        ch.items.forEach(item => {
                            if (item.type === 'verse') verseCount++;
                        });
                    }
                });
            }

            if (verseCount === 0) {
                stats.missingVerses.push(file);
            } else {
                stats.validBooks++;
            }

        } catch (err) {
            stats.malformedJson.push(`${file} (${err.message})`);
        }
    });

    console.log(`✅ Libros válidos: ${stats.validBooks}/${EXPECTED_BOOKS}`);

    if (stats.emptyFiles.length > 0) {
        console.error(`❌ Archivos de 0 KB: ${stats.emptyFiles.join(', ')}`);
        audit.totalErrors += stats.emptyFiles.length;
    }

    if (stats.malformedJson.length > 0) {
        console.error(`❌ JSON Mal formado: ${stats.malformedJson.join(', ')}`);
        audit.totalErrors += stats.malformedJson.length;
    }

    if (stats.missingVerses.length > 0) {
        console.warn(`⚠️ Libros sin versículos (posible error de split): ${stats.missingVerses.join(', ')}`);
    }

    audit.versions[version] = stats;
});

console.log('\n=======================================');
if (audit.totalErrors === 0) {
    console.log('✅ AUDITORÍA COMPLETADA: No se encontraron errores críticos.');
} else {
    console.error(`❌ AUDITORÍA COMPLETADA: Se encontraron ${audit.totalErrors} errores críticos.`);
}
console.log('=======================================');
