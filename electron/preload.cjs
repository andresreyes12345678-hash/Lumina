const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Security Hardened Script starting...');

try {
    // Whitelisted API exposure
    contextBridge.exposeInMainWorld('electronAPI', {
        // Triggering
        triggerSlide: (slideData) => ipcRenderer.send('trigger-slide', slideData),
        blackout: () => ipcRenderer.send('blackout'),
        
        // Window Control
        toggleProjection: () => ipcRenderer.send('toggle-projection'),
        requestCurrentState: () => ipcRenderer.send('request-current-state'),
        
        // Listeners (Subscribers)
        onGetCurrentState: (callback) => {
            const subscription = () => callback();
            ipcRenderer.on('get-current-state', subscription);
            return () => ipcRenderer.removeListener('get-current-state', subscription);
        },
        onUpdateStage: (callback) => {
            const subscription = (event, data) => callback(data);
            ipcRenderer.on('update-stage', subscription);
            return () => ipcRenderer.removeListener('update-stage', subscription);
        },
        onUpdatePreview: (callback) => {
            const subscription = (event, data) => callback(data);
            ipcRenderer.on('update-preview', subscription);
            return () => ipcRenderer.removeListener('update-preview', subscription);
        },

        getFilePath: (file) => {
            const { webUtils } = require('electron');
            return webUtils.getPathForFile(file);
        },

        // Media Library
        importMedia: (paths) => ipcRenderer.invoke('media:import', paths),
        getMediaLibrary: () => ipcRenderer.invoke('media:get-library'),
        deleteMedia: (id) => ipcRenderer.invoke('media:delete', id),
        updateMedia: (id, updates) => ipcRenderer.invoke('media:update', { id, updates }),

        // Video Runtime
        sendVideoControl: (data) => ipcRenderer.send('video-control', data),
        onVideoControl: (callback) => {
            const subscription = (event, data) => callback(data);
            ipcRenderer.on('video-control', subscription);
            return () => ipcRenderer.removeListener('video-control', subscription);
        },
        sendVideoEnded: () => ipcRenderer.send('video-ended'),
        onVideoEnded: (callback) => {
            const subscription = (event) => callback();
            ipcRenderer.on('video-ended', subscription);
            return () => ipcRenderer.removeListener('video-ended', subscription);
        },

        // System Events
        on: (channel, callback) => {
            const validChannels = ['media:library-update', 'media:conversion-progress'];
            if (validChannels.includes(channel)) {
                const subscription = (event, ...args) => callback(...args);
                ipcRenderer.on(channel, subscription);
                return () => ipcRenderer.removeListener(channel, subscription);
            }
        },

        // Bible
        loadBibleChapter: (params) => ipcRenderer.invoke('bible:load-chapter', params),
        searchBible: (params) => ipcRenderer.invoke('bible:search', params),
        getBibleVersions: () => ipcRenderer.invoke('bible:get-versions'),

        // Persistence
        saveData: (data) => ipcRenderer.invoke('data:save', data),
        loadData: () => ipcRenderer.invoke('data:load'),

        // NDI
        notifyNdiAnimation: (isAnimating) => ipcRenderer.send('ndi:animation', isAnimating),
        toggleNdi: (active) => ipcRenderer.send('ndi:toggle', active),
        getNdiStatus: () => ipcRenderer.invoke('ndi:status')
    });

    console.log('[Preload] Secure electronAPI exposed');
} catch (error) {
    console.error('[Preload] Error:', error);
}
