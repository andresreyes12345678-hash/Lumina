import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ControlWindow from './windows/ControlWindow';
import './index.css';

// ✓ VERIFY ELECTRON API IS AVAILABLE
console.log('=== ELECTRON API CHECK ===');
console.log('window.electronAPI exists:', !!window.electronAPI);
if (!window.electronAPI) {
    console.error('❌ CRITICAL: electronAPI not available! Preload script may have failed.');
} else {
    console.log('✅ electronAPI available');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ControlWindow />
    </React.StrictMode>
);
