const { app, BrowserWindow, ipcMain, screen, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// ===================================================
// PROTOCOL: Must be declared BEFORE app.whenReady()
// Enables streaming (range requests) for lumina-media://
// Required for video seeking to work correctly
// ===================================================
protocol.registerSchemesAsPrivileged([{
    scheme: 'lumina-media',
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,       // CRITICAL: enables HTTP Range requests for video seeking
        bypassCSP: true
    }
}]);

// Determine development mode correctly using standard electron paradigms
const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;

let controlWindow = null;
let stageWindow = null;
let splashWindow = null;

// App icon path (works for both dev and production)
const iconPath = path.join(__dirname, '..', 'Lumina-Icon.ico');

// === PERFORMANCE OPTIMIZATIONS ===
// GPU Video Decode — uses DXVA on Windows, VideoToolbox on macOS, VA-API on Linux
// NEVER disable this — it's the most impactful flag for video quality and performance
app.commandLine.appendSwitch('enable-gpu-rasterization');      // GPU canvas rendering
app.commandLine.appendSwitch('enable-zero-copy');              // Zero-copy video upload to GPU
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport'); // HEVC/H.265 hw decode
// NOTE: 'disable-accelerated-video-decode' was REMOVED — it was forcing CPU software decoding
// NOTE: 'force-wave-audio' was REMOVED — WaveOut is legacy, WASAPI gives better quality/latency
// NOTE: 'disable-audio-output-resampler' was REMOVED — causes format mismatches at audio output



// --- SPLASH SCREEN ---
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 420,
        height: 380,
        frame: false,
        transparent: true,
        resizable: false,
        center: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        icon: iconPath,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));

    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

function createControlWindow() {
    controlWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false, // Hidden until ready — splash covers the wait
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true, // Switched to true for security - ensure media is handled via protocol or similar
            backgroundThrottling: false
        },
        backgroundColor: '#0f172a',
        title: 'Lúmina - Control'
    });

    // --- SECURITY: NAVIGATION LOCKS ---
    controlWindow.webContents.on('will-navigate', (event, url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
            console.warn('[Security] Navigation blocked:', url);
            event.preventDefault();
        }
    });

    controlWindow.webContents.on('new-window', (event, url) => {
        const { shell } = require('electron');
        event.preventDefault();
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
            shell.openExternal(url);
        }
    });

    // Show main window when ready, close splash
    controlWindow.once('ready-to-show', () => {
        // Small delay to ensure modules finish initializing
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
            }
            controlWindow.show();
            controlWindow.focus();
        }, 800); // 800ms grace period for smoother transition
    });

    // Load control window
    if (process.env.VITE_DEV_SERVER_URL) {
        controlWindow.loadURL(process.env.VITE_DEV_SERVER_URL);

        // DevTools behavior handled by developer manually
        // controlWindow.webContents.on('did-finish-load', () => {
        //    if (isDev) { 
        //        controlWindow.webContents.openDevTools({ mode: 'right' }); 
        //    }
        // });

        controlWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            if (isDev) console.error('[Main] Failed to load:', errorCode, errorDescription);
        });
    } else {
        controlWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    controlWindow.on('closed', () => {
        controlWindow = null;
        if (stageWindow) {
            stageWindow.close();
        }
    });
}

function createStageWindow() {
    // Get all displays
    const displays = screen.getAllDisplays();

    // Find secondary display or use primary
    let externalDisplay = displays.find((display) => {
        return display.bounds.x !== 0 || display.bounds.y !== 0;
    });

    if (!externalDisplay) {
        externalDisplay = displays[0];
    }

    stageWindow = new BrowserWindow({
        x: externalDisplay.bounds.x,
        y: externalDisplay.bounds.y,
        width: externalDisplay.bounds.width,
        height: externalDisplay.bounds.height,
        fullscreen: true,
        frame: false,
        transparent: false, // Solid black background
        backgroundColor: '#000000',
        alwaysOnTop: true, // Keep on top of everything
        skipTaskbar: true, // Hide from taskbar
        focusable: false, // Do not accept focus (passive display)
        type: 'toolbar', // Hide from Alt+Tab (Windows) / Mission Control (macOS) - check OS behavior
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            backgroundThrottling: false // Important for video playback when not focused
        },
        title: 'Lúmina - Broadcast Output'
    });

    // --- SECURITY: NAVIGATION LOCKS ---
    stageWindow.webContents.on('will-navigate', (event) => event.preventDefault());

    // MacOS: Visible on all workspaces (Mission Control)
    if (process.platform === 'darwin') {
        stageWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

    // Windows: Prevent minimization ("Show Desktop" fix)
    stageWindow.on('minimize', (event) => {
        event.preventDefault();
        stageWindow.restore();
    });

    // Load stage window
    if (process.env.VITE_DEV_SERVER_URL) {
        stageWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '/stage.html');
    } else {
        stageWindow.loadFile(path.join(__dirname, '../dist/stage.html'));
    }

    stageWindow.on('closed', () => {
        stageWindow = null;
    });
}

app.whenReady().then(() => {
    // 0. Nuke ALL storage (ServiceWorkers, LocalStorage, Cache)
    // to prevent local dev conflicts with other PWAs on the same port
    const { session } = require('electron');
    session.defaultSession.clearStorageData();

    // 1. Show splash immediately
    createSplashWindow();

    // 2. Initialize backend managers
    try {
        if (isDev) console.log('[Main] Initializing Back-end Managers...');
        
        const mediaManager = require('./mediaManager.cjs');
        mediaManager.initializeLibrary();
        mediaManager.registerHandlers();

        // Custom Protocol for local media playback under secure CSP
        // Uses protocol.handle() (modern API) instead of deprecated registerFileProtocol
        // Supports HTTP Range requests via net.fetch() → enables video seeking and streaming
        protocol.handle('lumina-media', (request) => {
            try {
                const rawPath = request.url.slice('lumina-media://'.length);
                let filePath = decodeURIComponent(rawPath);
                
                // Fix Windows paths where `standard: true` stripped the colon from drive letter (e.g. "c/Users" -> "c:/Users")
                if (/^[a-zA-Z]\//.test(filePath)) {
                    filePath = filePath[0] + ':' + filePath.slice(1);
                }
                // Strip leading slash if present before Windows drive letter (e.g. "/c:/Users" or "/C:/Users")
                if (/^\/[a-zA-Z]:\//.test(filePath)) {
                    filePath = filePath.slice(1);
                }

                const normalizedPath = path.normalize(filePath);
                return net.fetch(pathToFileURL(normalizedPath).toString());
            } catch (error) {
                if (isDev) console.error('[Protocol] Failed to handle request:', error);
                return new Response('Not Found', { status: 404 });
            }
        });

        const dataManager = require('./dataManager.cjs');
        dataManager.initialize();
        dataManager.registerHandlers();

        const bibleManager = require('./bibleManager.cjs');
        bibleManager.initialize();
        bibleManager.registerHandlers();

        const ndiManager = require('./ndiManager.cjs');
        ndiManager.initialize(null, isDev);
        
        if (isDev) console.log('[Main] Backend initialization complete.');
    } catch (err) {
        console.error('[Main] Failed to initialize Managers:', err);
        if (isDev && err.stack) console.error(err.stack);
    }

    // 3. Create windows (control is hidden, splash is visible)
    createControlWindow();
    createStageWindow();

    // 4. Initialize Auto Updater
    const updater = require('./updater.cjs');
    updater.initialize(controlWindow);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createControlWindow();
            createStageWindow();
        }
    });

    // Handle standard IPC
    // ...
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- Helper: Robust Broadcast ---
const broadcast = (channel, data) => {
    const windows = [stageWindow, controlWindow];
    windows.forEach(win => {
        if (win && !win.isDestroyed()) {
            try {
                win.webContents.send(channel, data);
            } catch (err) {
                console.error(`[Main] IPC Send Error (${channel}):`, err.message);
            }
        }
    });
};

// --- IPC Handlers ---

// Re-Sync Request from StageDisplay
ipcMain.on('request-current-state', () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('get-current-state');
    }
});

// 1. Slide Trigger (Sync Control & Stage)
ipcMain.on('trigger-slide', (event, slideData) => {
    // Send to Stage
    if (stageWindow && !stageWindow.isDestroyed()) {
        stageWindow.webContents.send('update-stage', slideData);
    }
    // Echo to Control (Preview)
    if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('update-preview', slideData);
    }
});

// 2. Video Control — send ONLY to Stage (not broadcast to all windows)
// Previously used broadcast() which caused the Control window's LivePreview
// to also react to its own commands, creating a double-control loop.
ipcMain.on('video-control', (event, controlData) => {
    if (stageWindow && !stageWindow.isDestroyed()) {
        stageWindow.webContents.send('video-control', controlData);
    }
});

// 2b. Volume Control — dedicated channel for volume (Stage only)
ipcMain.on('video-volume', (event, volumeData) => {
    if (stageWindow && !stageWindow.isDestroyed()) {
        stageWindow.webContents.send('video-volume', volumeData);
    }
});

// 3. Video Ended (Upstream signal)
ipcMain.on('video-ended', () => {
    // Notify Control Window specifically to update UI/State
    if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('video-ended');
    }
});

// 4. Blackout / Global Clear
ipcMain.on('blackout', () => {
    if (stageWindow && !stageWindow.isDestroyed()) {
        stageWindow.webContents.send('update-stage', null);
    }
    if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('update-preview', null);
    }
});

// 5. Toggle Projection Window
ipcMain.on('toggle-projection', () => {
    if (stageWindow && !stageWindow.isDestroyed()) {
        if (stageWindow.isVisible()) {
            console.log('[Main] Ocultando ventana de proyección...');
            stageWindow.hide();
        } else {
            console.log('[Main] Mostrando ventana de proyección...');
            // The bounds might have changed if monitors changed, but for now we just show.
            stageWindow.show();
            // Request the current state explicitly to ensure perfect sync on un-hide
            if (controlWindow && !controlWindow.isDestroyed()) {
                controlWindow.webContents.send('get-current-state');
            }
        }
    } else {
        console.log('[Main] Re-creando ventana de proyección...');
        createStageWindow();
    }
});

// Development helpers
if (process.env.VITE_DEV_SERVER_URL) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}
