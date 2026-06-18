const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');
// const log = require('electron-log'); // Removido por ahora si no queremos agregar mas dependencias

let mainWindow = null;

function sendStatusToWindow(channel, data = null) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

function initialize(window) {
    mainWindow = window;

    // Configurar comportamiento: descargar automáticamente en segundo plano
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // Eventos del autoUpdater
    autoUpdater.on('checking-for-update', () => {
        console.log('[Updater] Buscando actualizaciones...');
        sendStatusToWindow('updater:checking');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[Updater] Actualización disponible:', info.version);
        sendStatusToWindow('updater:available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('[Updater] No hay actualizaciones disponibles.');
        sendStatusToWindow('updater:not-available', info);
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error en el actualizador:', err);
        sendStatusToWindow('updater:error', err.message || err.toString());
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Velocidad de descarga: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Descargado ' + progressObj.percent.toFixed(2) + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        console.log('[Updater]', log_message);
        
        sendStatusToWindow('updater:download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[Updater] Actualización descargada:', info.version);
        sendStatusToWindow('updater:downloaded', info);
    });

    // Registrar Handlers IPC para peticiones desde el Frontend
    ipcMain.handle('updater:check', () => {
        if (process.env.VITE_DEV_SERVER_URL) {
            console.log('[Updater] Saltando búsqueda de actualizaciones en entorno de desarrollo.');
            sendStatusToWindow('updater:not-available', { version: 'dev' });
            return;
        }
        autoUpdater.checkForUpdatesAndNotify();
    });

    ipcMain.handle('updater:install', () => {
        console.log('[Updater] Instalando actualización y reiniciando...');
        autoUpdater.quitAndInstall(false, true);
    });
    
    // Iniciar la primera búsqueda inmediatamente (si estamos en producción)
    if (!process.env.VITE_DEV_SERVER_URL) {
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify();
        }, 5000); // Dar 5 segundos para que la UI cargue
    }
}

module.exports = {
    initialize
};
