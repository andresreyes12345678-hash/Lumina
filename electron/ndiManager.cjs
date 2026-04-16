// electron/ndiManager.cjs
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let ndiSender = null;
let ndiWindow = null;
let isNdiInstalled = false;
let isNdiActive = false;
let captureInterval = null;

// Try to load NDI library gracefully
try {
    const ndi = require('@julusian/ndi');
    isNdiInstalled = true;
    console.log('[NDI] @julusian/ndi library found and loaded successfully.');
} catch (err) {
    console.warn('[NDI] NDI Library not found or failed to load. NDI features will be disabled gracefully.');
    console.warn('      If you wish to use NDI, please ensure native dependencies are installed.');
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
        if (!isNdiActive || !ndiWindow || !ndiSender) return;

        if (isAnimating) {
            // Start high-frequency capture during transition
            if (!captureInterval) {
                captureInterval = setInterval(() => captureAndSendFrame(), 1000 / 30); // 30 FPS
            }
        } else {
            // Stop high-frequency capture, capture one final static frame
            if (captureInterval) {
                clearInterval(captureInterval);
                captureInterval = null;
            }
            setTimeout(() => captureAndSendFrame(), 500); // one last clear frame
        }
    });

    // We can also trigger a capture immediately when a new slide arrives 
    // to ensure the static text updates if no animation was triggered.
    ipcMain.on('trigger-slide', () => {
        if (isNdiActive && !captureInterval) {
            setTimeout(() => captureAndSendFrame(), 50);
        }
    });
}

function startNdi(isDev) {
    if (!isNdiInstalled) return;

    try {
        const ndi = require('@julusian/ndi');
        ndiSender = new ndi.Sender({
            name: 'LUMINA LYRICS',
            colorFormat: ndi.NDIlib_FourCC_video_type_RGBA
        });
        console.log('[NDI] NDI Sender created: LUMINA LYRICS');

        createNdiWindow(isDev);
    } catch (err) {
        console.error('[NDI] Failed to start NDI Sender:', err);
    }
}

function stopNdi() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }

    if (ndiWindow && !ndiWindow.isDestroyed()) {
        ndiWindow.close();
        ndiWindow = null;
    }

    if (ndiSender) {
        // Assume close or destroy method
        try {
            if (typeof ndiSender.destroy === 'function') ndiSender.destroy();
            else if (typeof ndiSender.close === 'function') ndiSender.close();
        } catch (e) { }
        ndiSender = null;
    }
    console.log('[NDI] NDI Output stopped.');
}

function createNdiWindow(isDev) {
    if (ndiWindow) return;

    ndiWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        show: false, // Hidden window
        frame: false,
        transparent: true,
        backgroundColor: '#00000000', // fully transparent
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            offscreen: true // Critical for rendering without a visible window
        }
    });

    if (isDev) {
        ndiWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '/ndi.html');
    } else {
        ndiWindow.loadFile(path.join(__dirname, '../dist/ndi.html'));
    }

    // Force offscreen paint updates (though capturePage takes from GPU buffer)
    ndiWindow.webContents.on('paint', (event, dirty, image) => {
        // We could send frames here ideally! But let's stick to our polled/triggered manual capturePage to save CPU, 
        // OR we can just use the paint event since offscreen provides the NativeImage directly!
        // Using 'paint' is actually WAY more efficient than setInterval + capturePage.
        
        if (isNdiActive && ndiSender) {
             const buffer = image.getBitmap(); // Returns raw BGRA or RGBA
             try {
                // @julusian/ndi uses send({ videoStatus, videoData, audioStatus, audioData ... })
                ndiSender.send({
                    video: {
                        xres: 1920,
                        yres: 1080,
                        pictureAspectRatio: 1920 / 1080,
                        timestamp: 0,
                        data: buffer
                    }
                });
             } catch(e) {}
        }
    });
    
    ndiWindow.webContents.setFrameRate(30);

    ndiWindow.on('closed', () => {
        ndiWindow = null;
    });
}

function captureAndSendFrame() {
    if (!ndiWindow || !ndiWindow.isDestroyed() === false || !ndiSender) return;
    
    ndiWindow.webContents.capturePage().then((image) => {
         const buffer = image.getBitmap(); // BGRA/RGBA raw
         try {
             ndiSender.send({
                 video: {
                     xres: 1920,
                     yres: 1080,
                     data: buffer
                 }
             });
         } catch(e) {}
    }).catch(err => {
        // Ignore capture errors
    });
}

module.exports = {
    initialize
};
