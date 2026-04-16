/**
 * split_bible.js — Divide un archivo JSON de la Biblia en 66 archivos individuales.
 *
 * Uso:
 *   node scripts/split_bible.js biblia/ntv/NTV_vid_127.json
 *   node scripts/split_bible.js biblia/rvr2015/RVA2015_vid_1782.json
 */

const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normaliza un nombre de libro para usarlo como nombre de archivo.
 *   "Génesis"      → "genesis"
 *   "1 Samuel"     → "1_samuel"
 *   "Cantar de los Cantares" → "cantar_de_los_cantares"
 */
function normalizeName(name) {
  return name
    .normalize('NFD')                     // descompone tildes (é → e + ́)
    .replace(/[\u0300-\u036f]/g, '')      // elimina los diacríticos
    .toLowerCase()
    .replace(/\s+/g, '_')                 // espacios → guiones bajos
    .replace(/[^a-z0-9_]/g, '');          // elimina caracteres especiales
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // 1. Validar argumento
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('❌ Error: Debes proporcionar la ruta al archivo JSON.');
    console.error('   Uso: node scripts/split_bible.js <ruta-al-json>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(inputPath);

  // 2. Verificar que el archivo existe
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: No se encontró el archivo "${resolvedPath}"`);
    process.exit(1);
  }

  // 3. Leer y parsear el JSON
  console.log(`📖 Leyendo "${resolvedPath}"...`);
  let data;
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Error al parsear el archivo JSON: ${err.message}`);
    process.exit(1);
  }

  // 4. Validar estructura
  if (!data.books || !Array.isArray(data.books)) {
    console.error('❌ Error: El archivo no contiene un array "books". Formato inesperado.');
    process.exit(1);
  }

  const version = data.local_abbreviation || 'unknown';
  const outputDir = path.dirname(resolvedPath);

  console.log(`📚 Versión: ${version} — ${data.books.length} libros encontrados`);
  console.log(`📁 Directorio de salida: ${outputDir}\n`);

  // 5. Iterar sobre cada libro y exportar
  let successCount = 0;

  data.books.forEach((book, index) => {
    const bookNumber = index + 1;
    const bookName = book.name || `libro_${bookNumber}`;
    const fileName = `${bookNumber}-${normalizeName(bookName)}.json`;
    const filePath = path.join(outputDir, fileName);

    // Escribir el objeto del libro completo
    const bookData = {
      book_usfm: book.book_usfm,
      name: book.name,
      chapters: book.chapters,
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(bookData, null, 2), 'utf8');
      console.log(`✅ Libro "${bookName}" exportado con éxito → ${fileName}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Error al escribir "${fileName}": ${err.message}`);
    }
  });

  // 6. Resumen
  console.log(`\n🎉 Proceso completado: ${successCount}/${data.books.length} libros exportados.`);
}

main();
