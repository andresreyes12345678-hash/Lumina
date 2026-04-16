const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'store', 'useStore.ts');
console.log('Reading:', filePath);

let content = fs.readFileSync(filePath, 'utf-8');

// 1. Rename saveDataToElectron to saveToLocalStorage
content = content.replace(/const saveDataToElectron =/, 'const saveToLocalStorage =');

// 2. Remove the garbage block.
// The block starts AFTER the first 'export const useStore = ...' and ends at the SECOND 'export const useStore ...'
// We identify the second one by indentation or context.

const startMarker = 'export const useStore = create<Store>((set, get) => ({';
// Find first occurrence
const firstIndex = content.indexOf(startMarker);
if (firstIndex === -1) {
    console.error('Could not find useStore start');
    process.exit(1);
}

// Find second occurrence (after first)
const secondIndex = content.indexOf(startMarker, firstIndex + startMarker.length);

if (secondIndex !== -1) {
    console.log('Found duplicate useStore declaration. Removing garbage in between.');
    // The garbage is between (firstIndex + length) and secondIndex.
    // However, the second index includes the marker itself.
    // We want to KEEP the first marker, DELETE the garbage, and DELETE the second marker?
    // No, we want to KEEP the first marker, DELETE the garbage, and KEEP the content *after* the second marker line (which is the body).
    // Wait, the second marker *starts* the real body?
    // Let's look at the file content again.
    // Line 198: export const useStore...
    // Line 223:     export const useStore... (Indented)

    // The previous edit attempts failed, so the file is likely in a state where:
    // 198 is valid.
    // 199-222 is garbage.
    // 223 is duplicate line.

    // So we want to remove from (firstIndex + startMarker.length) up to (secondIndex + startMarker.length).
    // No, up to (secondIndex + startMarker.length) would remove the second 'export const...'.
    // Result: 'export const useStore = ...' (first) + (content after second).
    // Yes.

    const before = content.substring(0, firstIndex + startMarker.length);
    const after = content.substring(secondIndex + startMarker.length);
    content = before + after;
    console.log('Garbage removed.');
} else {
    console.log('Duplicate not found?');
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done.');
