const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const crypto = require('crypto');

// Static Binaries
let ffmpegPath;
let ffprobePath;

try {
    ffmpegPath = require('ffmpeg-static');
    // Handle some os specific weirdness or null
    if (!ffmpegPath) throw new Error('ffmpeg-static returned null/undefined');
    // Ensure it is a valid string
    if (typeof ffmpegPath !== 'string') throw new Error(`ffmpeg-static returned unexpected type: ${typeof ffmpegPath}`);
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log('[MediaManager] FFmpeg path set:', ffmpegPath);
} catch (e) {
    console.error('[MediaManager] Failed to set FFmpeg path:', e);
}

try {
    const ffprobeStatic = require('ffprobe-static');
    ffprobePath = ffprobeStatic.path;
    if (!ffprobePath) throw new Error('ffprobe-static path is null/undefined');
    ffmpeg.setFfprobePath(ffprobePath);
    console.log('[MediaManager] FFprobe path set:', ffprobePath);
} catch (e) {
    console.error('[MediaManager] Failed to set FFprobe path:', e);
}

// Configuration
const LIBRARY_FOLDER_NAME = 'Lumina_Library';
const DB_FILE_NAME = 'media-db.json';

let libraryPath = '';
let videosPath = '';
let thumbnailsPath = '';
let dbPath = '';

// Database Cache
let mediaLibrary = { files: [] };

/**
 * Initialize the library structure and load the database
 */
function initializeLibrary() {
    try {
        const userDataPath = app.getPath('userData');
        libraryPath = path.join(userDataPath, LIBRARY_FOLDER_NAME);
        videosPath = path.join(libraryPath, 'videos');
        thumbnailsPath = path.join(libraryPath, 'thumbnails');
        dbPath = path.join(libraryPath, DB_FILE_NAME);

        // Ensure directories exist
        if (!fs.existsSync(libraryPath)) fs.mkdirSync(libraryPath);
        if (!fs.existsSync(videosPath)) fs.mkdirSync(videosPath);
        if (!fs.existsSync(thumbnailsPath)) fs.mkdirSync(thumbnailsPath);

        // Load DB
        if (fs.existsSync(dbPath)) {
            try {
                const data = fs.readFileSync(dbPath, 'utf-8');
                mediaLibrary = JSON.parse(data);
            } catch (e) {
                console.error('Error parsing media DB, resetting:', e);
                mediaLibrary = { files: [] };
            }
        } else {
            saveDatabase();
        }

        console.log('[MediaManager] Library initialized at:', libraryPath);
    } catch (error) {
        console.error('[MediaManager] Initialization failed:', error);
    }
}

/**
 * Save current state to JSON DB
 */
function saveDatabase() {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(mediaLibrary, null, 2));
    } catch (error) {
        console.error('[MediaManager] Failed to save DB:', error);
    }
}

/**
 * Generate a unique filename if conflict exists
 */
function getUniqueFilename(directory, filename) {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    let counter = 1;
    let newFilename = filename;

    while (fs.existsSync(path.join(directory, newFilename))) {
        newFilename = `${name}_${counter}${ext}`;
        counter++;
    }

    return newFilename;
}

/**
 * Extract metadata using ffprobe
 */
function getFileMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata);
        });
    });
}

/**
 * Import a single media file
 */
async function importMediaFile(event, sourcePath) {
    try {
        if (!fs.existsSync(sourcePath)) throw new Error('File does not exist');

        const fileExt = path.extname(sourcePath).toLowerCase();
        // Determine type (simple extension check for now)
        const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(fileExt);
        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt);

        if (!isVideo && !isImage) throw new Error('Unsupported file type');

        // Check metadata to decide on conversion
        let needsConversion = false;
        let audioNeedsConversion = true; // Default to conversion
        if (isVideo) {
            try {
                const metadata = await getFileMetadata(sourcePath);
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                // Check if it's already compatible (mp4 + h264)
                if (fileExt !== '.mp4' || (videoStream && videoStream.codec_name !== 'h264')) {
                    needsConversion = true;
                }

                // Check Audio Quality
                const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
                if (audioStream) {
                    const isGoodCodec = ['aac', 'mp3'].includes(audioStream.codec_name);
                    if (isGoodCodec) {
                        audioNeedsConversion = false;
                        console.log(`[MediaManager] Good audio codec detected (${audioStream.codec_name}). Using passthrough.`);
                    }
                }
            } catch (e) {
                console.warn('[MediaManager] Metadata check failed, forcing conversion:', e);
                needsConversion = true;
            }
        }

        // --- 1. Prepare Paths ---
        // If converting, force .mp4 extension
        const targetFilename = getUniqueFilename(videosPath, isVideo && needsConversion
            ? path.basename(sourcePath, fileExt) + '.mp4'
            : path.basename(sourcePath));

        const targetPath = path.join(videosPath, targetFilename);

        // Thumbnail path
        const thumbFilename = path.basename(targetFilename, path.extname(targetFilename)) + '.jpg';
        const targetThumbPath = path.join(thumbnailsPath, thumbFilename);

        // --- 2. Process File ---
        if (isVideo) {
            if (needsConversion) {
                // FULL RE-ENCODE: Source is not h264/mp4, encode with maximum quality
                console.log(`[MediaManager] Converting ${sourcePath} to ${targetPath}`);
                console.log('[MediaManager] Quality: x264 High Profile, CRF 17, preset slow, AAC 320k');

                await new Promise((resolve, reject) => {
                    const command = ffmpeg(sourcePath)
                        .output(targetPath)
                        // VIDEO: Studio Quality (Broadcast)
                        .videoCodec('libx264')
                        .outputOptions([
                            '-profile:v high',
                            '-level 4.1',
                            '-crf 18',                  // Visually lossless
                            '-preset slow',             // Preserve details
                            '-tune film',               // Preserve grain and sharpness
                            '-pix_fmt yuv420p',         // Maximum compatibility
                            '-movflags +faststart'      // Instant playback on local projection
                        ])
                        // AUDIO: Conditional Passthrough vs Re-encode
                        .on('start', (cmd) => {}) // Placeholder for chained commands
                    
                    if (audioNeedsConversion) {
                        command
                            .audioCodec('libopus')
                            .audioBitrate('320k')
                            .audioChannels(2)
                            .audioFrequency(48000)
                            .outputOptions([
                                '-af loudnorm'
                            ]);
                    } else {
                        command.audioCodec('copy');
                    }

                    command
                        .on('start', (commandLine) => {
                            console.log('[MediaManager] FFmpeg command:', commandLine);
                        })
                        .on('progress', (progress) => {
                            if (event) event.sender.send('media:conversion-progress', {
                                file: path.basename(sourcePath),
                                percent: progress.percent
                            });
                            if (progress.percent && progress.percent % 25 < 1) {
                                console.log(`[MediaManager] Conversion progress: ${Math.round(progress.percent)}%`);
                            }
                        })
                        .on('end', () => {
                            console.log('[MediaManager] ✅ Conversion completed successfully');
                            console.log(`[MediaManager] Output file: ${targetPath}`);
                            resolve();
                        })
                        .on('error', (err) => {
                            console.error('[MediaManager] ❌ FFmpeg conversion error:', err.message);
                            console.error('[MediaManager] Full error:', err);
                            reject(err);
                        });

                    command.run();
                });
            } else {
                // STREAM COPY: Source is already mp4+h264, remux without re-encoding
                // This preserves 100% original quality while adding faststart for instant playback
                console.log(`[MediaManager] Remuxing (stream copy) ${sourcePath} to ${targetPath}`);

                await new Promise((resolve, reject) => {
                    ffmpeg(sourcePath)
                        .output(targetPath)
                        .videoCodec('copy')             // No re-encoding = zero quality loss
                        .audioCodec('copy')             // Preserve original audio exactly
                        .outputOptions([
                            '-movflags +faststart'      // Add instant playback support
                        ])
                        .on('start', (cmd) => console.log('[MediaManager] Remux command:', cmd))
                        .on('end', () => {
                            console.log('[MediaManager] ✅ Remux completed (lossless)');
                            resolve();
                        })
                        .on('error', (err) => {
                            // Fallback: if remux fails, do a plain file copy
                            console.warn('[MediaManager] Remux failed, falling back to copy:', err.message);
                            try {
                                fs.copyFileSync(sourcePath, targetPath);
                                resolve();
                            } catch (copyErr) {
                                reject(copyErr);
                            }
                        })
                        .run();
                });
            }

            // Generate Thumbnail
            await new Promise((resolve, reject) => {
                ffmpeg(targetPath)
                    .screenshots({
                        timestamps: ['00:00:01.000'],
                        filename: thumbFilename,
                        folder: thumbnailsPath,
                        size: '320x?'
                    })
                    .on('end', resolve)
                    .on('error', (err) => {
                        console.error('Thumbnail generation failed', err);
                        // Resolve anyway, don't block import
                        resolve();
                    });
            });

        } else if (isImage) {
            // Images just get copied
            console.log(`[MediaManager] Copying image ${sourcePath} to ${targetPath}`);
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`[MediaManager] Image copied successfully`);
            // Use same image as "thumbnail" (or resize if optimization needed later)
            // For now, simple copy/reference
        }

        // --- 3. Save to DB ---
        const newEntry = {
            id: crypto.randomUUID(),
            name: targetFilename,
            path: targetPath, // Absolute path for now
            thumbnail: isVideo ? targetThumbPath : targetPath,
            type: isVideo ? 'video' : 'image',
            dateAdded: new Date().toISOString()
        };

        console.log('[MediaManager] New entry created:', newEntry);
        mediaLibrary.files.push(newEntry);
        saveDatabase();
        console.log('[MediaManager] Database saved. Total files:', mediaLibrary.files.length);

        // Notify frontend
        if (event) {
            console.log('[MediaManager] Sending library-update event with', mediaLibrary.files.length, 'files');
            event.sender.send('media:library-update', mediaLibrary.files);
        } else {
            console.warn('[MediaManager] No event object, cannot send library-update');
        }

        return newEntry;

    } catch (error) {
        console.error('[MediaManager] Import failed:', error);
        throw error;
    }
}

/**
 * Register IPC Handlers
 */
function registerHandlers() {
    ipcMain.handle('media:import', async (event, filePaths) => {
        const results = [];
        // Handle array or single string
        const paths = Array.isArray(filePaths) ? filePaths : [filePaths];

        for (const filePath of paths) {
            try {
                const result = await importMediaFile(event, filePath);
                results.push({ status: 'success', file: result });
            } catch (error) {
                results.push({ status: 'error', path: filePath, error: error.message });
            }
        }
        return results;
    });

    ipcMain.handle('media:get-library', () => {
        return mediaLibrary.files;
    });

    // Add handler to delete media
    ipcMain.handle('media:delete', (event, id) => {
        const index = mediaLibrary.files.findIndex(f => f.id === id);
        if (index !== -1) {
            const file = mediaLibrary.files[index];
            try {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                if (file.thumbnail && fs.existsSync(file.thumbnail) && file.thumbnail !== file.path) {
                    fs.unlinkSync(file.thumbnail);
                }
            } catch (e) {
                console.error("Error deleting physical files", e);
            }

            mediaLibrary.files.splice(index, 1);
            saveDatabase();
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    });

    // Add handler to update media properties (PERSISTENCE FIX)
    ipcMain.handle('media:update', (event, { id, updates }) => {
        const index = mediaLibrary.files.findIndex(f => f.id === id);
        if (index !== -1) {
            // Merge updates
            mediaLibrary.files[index] = { ...mediaLibrary.files[index], ...updates };
            saveDatabase();
            console.log(`[MediaManager] Updated file ${id} with`, updates);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    });
}

module.exports = {
    initializeLibrary,
    registerHandlers
};
