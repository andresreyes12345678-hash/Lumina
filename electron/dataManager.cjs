const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');

class DataManager {
    constructor() {
        this.userDataPath = app.getPath('userData');
        this.dbPath = path.join(this.userDataPath, 'lumina_db.json');
        console.log('[DataManager] Database path:', this.dbPath);
    }

    initialize() {
        // Ensure file exists
        if (!fs.existsSync(this.dbPath)) {
            console.log('[DataManager] No database found, creating empty default.');
            this.saveData({
                songs: [],
                songFolders: [],
                mediaFolders: [],
                // Other defaults can be handled by Store if missing, 
                // but nice to have structure.
                version: 1
            });
        }
    }

    registerHandlers() {
        ipcMain.handle('data:load', async () => {
            try {
                if (!fs.existsSync(this.dbPath)) {
                    console.warn('[DataManager] DB file missing during load, returning empty.');
                    return null;
                }
                let data = fs.readFileSync(this.dbPath, 'utf-8');
                
                // --- PROTOCOL MIGRATION ---
                // Revert any lumina-media:// links back to file:///
                if (data.includes('lumina-media://')) {
                    console.log('[DataManager] Migrating lumina-media:// links back to file:///');
                    data = data.replace(/lumina-media:\/\/C:/g, 'file:///C:');
                    data = data.replace(/lumina-media:\/\/c\//g, 'file:///C:/'); // Handle lowercased Drive letter
                    data = data.replace(/lumina-media:\/\//g, 'file:///');
                }

                // Basic validation
                if (!data || data.trim() === '') {
                    console.warn('[DataManager] DB file empty. Returning null.');
                    return null;
                }
                return JSON.parse(data);
            } catch (err) {
                console.error('[DataManager] Error loading data:', err);
                // Attempt to backup corrupt file
                try {
                    const backupPath = this.dbPath + '.corrupt.' + Date.now();
                    fs.copyFileSync(this.dbPath, backupPath);
                    console.error('[DataManager] Corrupt DB backed up to:', backupPath);
                } catch (e) {
                    console.error('[DataManager] Failed to backup corrupt DB:', e);
                }
                // Return null so the store can initialize with defaults instead of crashing
                return null;
            }
        });

        // Save Queue to prevent race conditions (ENOENT on temp file)
        this.saveQueue = Promise.resolve();

        ipcMain.handle('data:save', async (event, data) => {
            // Check queue length or debounce? strict serialization is safer for now.
            // Chain this request to the end of the queue
            const currentTask = this.saveQueue.then(async () => {
                try {
                    // SAFE LOGGING to prevent EPIPE crashes if parent process disconnects
                    const safeLog = (...args) => { try { console.log(...args); } catch (e) { } };
                    const safeError = (...args) => { try { console.error(...args); } catch (e) { } };
                    safeLog('[DataManager] Saving data...', Object.keys(data).join(', '));

                    // ATOMIC WRITE: Write to .tmp then rename
                    const tempPath = this.dbPath + '.tmp';

                    await new Promise((resolve, reject) => {
                        const json = JSON.stringify(data, null, 2);
                        // safeLog('[DataManager] Payload size:', json.length, 'bytes'); // Commented out to reduce noise/risk

                        fs.writeFile(tempPath, json, (err) => {
                            if (err) {
                                safeError('[DataManager] Write to temp failed:', err);
                                reject(err);
                            } else {
                                // Rename (Atomic replace)
                                fs.rename(tempPath, this.dbPath, (renameErr) => {
                                    if (renameErr) {
                                        safeError('[DataManager] Rename failed:', renameErr);
                                        // Try delete temp
                                        try { fs.unlinkSync(tempPath); } catch (e) { }
                                        reject(renameErr);
                                    } else {
                                        safeLog('[DataManager] Save successful to:', this.dbPath);
                                        resolve({ success: true });
                                    }
                                });
                            }
                        });
                    });

                    return { success: true };
                } catch (err) {
                    safeError('[DataManager] Error saving data:', err);
                    return { success: false, error: err.message };
                }
            });

            // Update queue head
            // We catch errors in the chain so the queue doesn't stall on failure
            this.saveQueue = currentTask.catch(() => { });

            return currentTask;
        });
    }

    saveData(data) {
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    }
}

module.exports = new DataManager();
