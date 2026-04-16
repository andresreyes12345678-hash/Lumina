const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// Determine development mode correctly using standard electron paradigms
const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;

let controlWindow = null;
let stageWindow = null;
let splashWindow = null;

// App icon path (works for both dev and production)
const iconPath = path.join(__dirname, '..', 'Lumina-Icon.ico');

// === PERFORMANCE OPTIMIZATIONS ===
// Enable hardware acceleration (GPU rendering for video)
// This is enabled by default, but we ensure it's not disabled
// app.disableHardwareAcceleration(); // DO NOT call this

// Clean implementation without custom protocols
// Relying on webSecurity: false to allow file:// access
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
// Force GPU acceleration for video decoding
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('audio-buffer-size', '4096');
app.commandLine.appendSwitch('force-wave-audio');
app.commandLine.appendSwitch('disable-audio-output-resampler');
app.commandLine.appendSwitch('disable-accelerated-video-decode');



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
        const { protocol } = require('electron');
        protocol.registerFileProtocol('lumina-media', (request, callback) => {
            const url = request.url.replace('lumina-media://', '');
            try {
                // Remove trailing slashes gracefully handled by node APIs
                return callback(decodeURIComponent(url));
            } catch (error) {
                if (isDev) console.error('[Protocol] Fallo al decodificar la ruta:', error);
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

// 2. Video Control (Sync Play/Pause/Seek)
ipcMain.on('video-control', (event, controlData) => {
    broadcast('video-control', controlData);
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
