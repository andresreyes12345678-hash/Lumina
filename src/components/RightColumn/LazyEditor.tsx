import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Save, X, Upload } from 'lucide-react';

const LazyEditor: React.FC = () => {
    const { editingSlideId, slides, songs, selectedSongId, updateSlide, stopEditing, addSlides } = useStore();

    // Correctly find the slide whether it's in a Song or in the direct slides array
    const editingSlide = React.useMemo(() => {
        if (!editingSlideId) return undefined;

        // 1. Try finding in selected song
        if (selectedSongId) {
            const song = songs.find(s => s.id === selectedSongId);
            const slide = song?.slides.find(s => s.id === editingSlideId);
            if (slide) return slide;
        }

        // 2. Fallback to direct slides (Bible, etc)
        return slides.find(s => s.id === editingSlideId);
    }, [editingSlideId, slides, songs, selectedSongId]);

    const [content, setContent] = useState('');

    // Update local content when slide changes (initial load)
    React.useEffect(() => {
        if (editingSlide) {
            setContent(editingSlide.content);
        }
    }, [editingSlide]);

    React.useEffect(() => {
        if (!editingSlide) {
            stopEditing();
        }
    }, [editingSlide, stopEditing]);

    if (!editingSlide) {
        return null;
    }

    const handleSave = () => {
        updateSlide(editingSlide.id, { content });
        stopEditing();
    };

    const handleCancel = () => {
        stopEditing();
    };

    const handleImportFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;

            // Show confirmation
            const shouldImport = confirm('¿Importar texto y crear nuevas diapositivas?');
            if (!shouldImport) return;

            // Parse text into slides (split by double line breaks)
            const paragraphs = text.split(/\n\s*\n/);
            const newSlides = paragraphs
                .filter(p => p.trim().length > 0)
                .map((slideContent, index) => ({
                    id: `slide-${Date.now()}-${index}`,
                    content: slideContent.trim(),
                    fontFamily: 'Open Sans',
                    fontSize: 64
                }));

            addSlides(newSlides);
            stopEditing();
        } catch (error) {
            alert('No se pudo acceder al portapapeles. Pega el texto manualmente.');
        }
    };

    return (
        <div className="p-4 flex-1 flex flex-col border-t border-gray-700">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">Editor</h3>
                <button
                    onClick={handleCancel}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                placeholder="Escribe el contenido de la diapositiva..."
            />

            <div className="flex gap-2">
                <button
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm"
                >
                    <Save size={16} />
                    Guardar
                </button>
                <button
                    onClick={handleImportFromClipboard}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                >
                    <Upload size={16} />
                    Importar
                </button>
            </div>
        </div>
    );
};

export default LazyEditor;
