import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import StageDisplay from './windows/StageDisplay';
import './index.css';

ReactDOM.createRoot(document.getElementById('stage-root')!).render(
    <React.StrictMode>
        <StageDisplay />
    </React.StrictMode>
);
