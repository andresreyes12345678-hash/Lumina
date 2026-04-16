const path = require('path');
const fs = require('fs');

console.log('--- starting debug media ---');
console.log('Current working directory:', process.cwd());

try {
    console.log('Attempting to require ffmpeg-static...');
    const ffmpegPath = require('ffmpeg-static');
    console.log('ffmpeg-static path:', ffmpegPath);

    if (ffmpegPath) {
        try {
            fs.accessSync(ffmpegPath, fs.constants.X_OK);
            console.log('ffmpeg binary is executable');
        } catch (e) {
            console.error('ffmpeg binary is NOT executable or does not exist:', e.message);
        }
    }

    console.log('Attempting to require ffprobe-static...');
    const ffprobeStatic = require('ffprobe-static');
    console.log('ffprobe-static object:', ffprobeStatic);
    const ffprobePath = ffprobeStatic.path;
    console.log('ffprobe-static path:', ffprobePath);

    if (ffprobePath) {
        try {
            fs.accessSync(ffprobePath, fs.constants.X_OK);
            console.log('ffprobe binary is executable');
        } catch (e) {
            console.error('ffprobe binary is NOT executable or does not exist:', e.message);
        }
    }

    // Mock electron app for mediaManager
    const electronMock = {
        app: {
            getPath: (name) => {
                console.log(`Mock app.getPath called for: ${name}`);
                if (name === 'userData') return path.join(process.cwd(), 'temp-userdata');
                return '';
            }
        },
        ipcMain: {
            handle: (channel, handler) => {
                console.log(`Mock ipcMain.handle called for channel: ${channel}`);
            }
        }
    };

    // Require mediaManager to test it (now .cjs)
    // require('../electron/mediaManager.cjs');
    // This is tricky in a simple script without a loader hook.
    // Instead, we will try to load mediaManager only if we can patch how it gets 'electron'
    // OR we can just rely on the dynamic requires in the main app.

    // For this debug script, let's just test the BINARIES which are the likely culprit.
    // If we try to require mediaManager directly it will fail on `require('electron')`.

    const { execSync } = require('child_process');
    if (ffmpegPath) {
        console.log('Running ffmpeg -version...');
        const output = execSync(`"${ffmpegPath}" -version`).toString();
        console.log('ffmpeg version output head:', output.split('\n')[0]);
    }

} catch (err) {
    console.error('CRITICAL ERROR in debug script:', err);
}

console.log('--- finished debug media ---');
