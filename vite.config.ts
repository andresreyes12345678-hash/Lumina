import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    base: './',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                stage: path.resolve(__dirname, 'stage.html'),
                ndi: path.resolve(__dirname, 'ndi.html')
            }
        }
    },
    server: {
        port: 5180
    }
});
