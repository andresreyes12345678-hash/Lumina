// electron/ndiManager.cjs
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let ndiSource = null;
let ndiWindow = null;
let isNdiInstalled = false;
let isNdiActive = false;
let frameSubscription = null;

// Try to load NDI library gracefully
try {
    // Act as a fallback in case the native C++ library is not compiled or missing.
    const { NdiSource } = require('@lwon/node-ndi');
    isNdiInstalled = true;
    console.log('[NDI] @lwon/node-ndi library found and loaded successfully.');
} catch (err) {
    console.warn('[NDI] @lwon/node-ndi library not found or failed to load. NDI features will be disabled gracefully.');
    console.warn('      If you wish to use NDI, please run "npm run rebuild" to compile the native module.');
}

function initialize(mainWindow, isDev) {
    // 1. IPC Handlers
    ipcMain.handle('ndi:status', () => {
        return {
            installed: isNdiInstalled,
            active: isNdiActive
        };
    });

    ipcMain.on('ndi:toggle', (event, active) => {
        if (!isNdiInstalled) return;
        
        console.log(`[NDI] Toggling NDI output: ${active}`);
        isNdiActive = active;

        if (active) {
            startNdi(isDev);
        } else {
            stopNdi();
        }
    });

    ipcMain.on('ndi:animation', (event, isAnimating) => {
        // Not used extensively now since offscreen paint/frame subscription
        // automatically captures frames at 30/60 FPS only when updates occur.
    });

    ipcMain.on('trigger-slide', () => {
        // Handled automatically by the window rendering and triggering paint events.
    });
}

function startNdi(isDev) {
    if (!isNdiInstalled) return;

    try {
        const { NdiSource } = require('@lwon/node-ndi');
        
        // Initialize the NDI Source stream.
        ndiSource = new NdiSource("Lumina - Letras");
        console.log('[NDI] NdiSource created: Lumina - Letras');

        createNdiWindow(isDev);
    } catch (err) {
        console.error('[NDI] Failed to start NDI Source:', err);
    }
}

function stopNdi() {
    // Clean up frame subscription if any
    if (frameSubscription) {
        try {
            frameSubscription.unsubscribe();
        } catch (e) {}
        frameSubscription = null;
    }

    if (ndiWindow && !ndiWindow.isDestroyed()) {
        ndiWindow.close();
        ndiWindow = null;
    }

    if (ndiSource) {
        try {
            if (typeof ndiSource.destroy === 'function') {
                ndiSource.destroy();
            } else if (typeof ndiSource.close === 'function') {
                ndiSource.close();
            }
        } catch (e) {
            console.warn('[NDI] Error destroying NdiSource:', e.message);
        }
        ndiSource = null;
    }
    console.log('[NDI] NDI Output stopped.');
}

function createNdiWindow(isDev) {
    if (ndiWindow) return;

    // Create a dedicated offscreen window to capture frames without cluttering the screen.
    ndiWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        show: false, // Keep invisible
        frame: false,
        transparent: true,
        backgroundColor: '#00000000', // transparent alpha channel background
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            offscreen: true, // Render to GPU/CPU memory buffers directly
            backgroundThrottling: false // Keep full rendering performance when hidden
        }
    });

    if (isDev) {
        ndiWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '/ndi.html');
    } else {
        ndiWindow.loadFile(path.join(__dirname, '../dist/ndi.html'));
    }

    // Set stable frame rate (30 FPS as base, can be 60 if needed)
    ndiWindow.webContents.setFrameRate(30);

    // Capture using standard Offscreen Rendering paint events
    ndiWindow.webContents.on('paint', (event, dirty, image) => {
        if (isNdiActive && ndiSource) {
            try {
                // image is a NativeImage. getBitmap() returns raw pixel data (BGRA or RGBA).
                const buffer = image.getBitmap();
                ndiSource.sendFrame(buffer);
            } catch (err) {
                // Suppress send errors to avoid logging spam during rapid updates
            }
        }
    });

    // Alternatively, subscribe to frame updates using beginFrameSubscription as a fallback or secondary method
    // webContents.beginFrameSubscription is highly efficient as it gets GPU updates directly.
    try {
        ndiWindow.webContents.beginFrameSubscription((image) => {
            if (isNdiActive && ndiSource) {
                try {
                    const buffer = image.getBitmap();
                    ndiSource.sendFrame(buffer);
                } catch (err) {
                    // Suppress
                }
            }
        });
    } catch (e) {
        console.warn('[NDI] beginFrameSubscription not supported or failed to initialize:', e.message);
    }

    ndiWindow.on('closed', () => {
        ndiWindow = null;
    });
}

module.exports = {
    initialize
};
