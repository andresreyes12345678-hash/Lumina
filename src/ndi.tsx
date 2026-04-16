import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import NdiView from './windows/NdiView';
import './index.css';

ReactDOM.createRoot(document.getElementById('ndi-root')!).render(
    <React.StrictMode>
        <NdiView />
    </React.StrictMode>
);
