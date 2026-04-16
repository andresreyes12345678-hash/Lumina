import React, { useEffect } from 'react';
import { Clock, BookOpen, Play } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useBibleStore, HistoryVerse } from '../../store/bibleStore';

const RecentBibleHistory: React.FC = () => {
    const activeSlide = useStore(state => state.activeSlide);
    const bibleState = useStore(state => state.bibleState);
    const { recentVerses, addToHistory, currentBookIndex, loadBook } = useBibleStore();

    // Catch Live Projections
    useEffect(() => {
        if (activeSlide && activeSlide.type === 'bible' && currentBookIndex !== null) {
            try {
                // Determine Reference and text
                const parts = activeSlide.content.split('\n\n');
                if (parts.length < 2) return;
                
                const reference = parts[0].trim(); // e.g. "Génesis 1:1"
                const text = parts.slice(1).join('\n\n').trim();
                
                const match = reference.match(/(.+) (\d+):(\d+)/);
                if (match) {
                    const bookName = match[1];
                    const chapter = parseInt(match[2], 10);
                    const verse = parseInt(match[3], 10);

                    // Add to volatile history
                    addToHistory({
                        reference,
                        version: bibleState.version || 'rvr1960',
                        text,
                        bookName,
                        bookIndex: currentBookIndex,
                        chapter,
                        verse
                    });
                }
            } catch (err) {
                console.error('[RecentBibleHistory] Error al parsear slide bíblico:', err);
            }
        }
    }, [activeSlide?.id]); // Only run when slide id changes

    const handleHistoryClick = async (history: HistoryVerse) => {
        // Load the book/chapter required
        await loadBook(history.bookName, history.bookIndex, history.version, history.chapter);
        
        // Find slide to project
        const slides = useStore.getState().slides;
        const targetId = `bible-${history.bookName}-${history.chapter}-v${history.verse}`;
        const targetSlide = slides.find(s => s.id === targetId);
        
        if (targetSlide) {
            // Project
            useStore.getState().setActiveSlide(targetSlide);
        } else {
            console.warn(`[RecentBibleHistory] No se encontró el slide ${targetId} tras cargar el capítulo`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
            <div className="flex-none p-4 pb-2 border-b border-gray-800">
                <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Clock size={18} />
                    <h2 className="font-semibold tracking-wide uppercase text-sm">Historial de Proyección</h2>
                </div>
                <p className="text-xs text-gray-400">
                    Versículos recientes de la sesión actual
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {recentVerses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-center px-4">
                        <BookOpen size={32} className="mb-3 opacity-20" />
                        <p className="text-sm">El historial está vacío.</p>
                        <p className="text-xs mt-1">Los versículos proyectados aparecerán aquí.</p>
                    </div>
                ) : (
                    recentVerses.map((item) => (
                        <div 
                            key={`${item.reference}-${item.version}`}
                            className="group relative bg-gray-800/40 hover:bg-indigo-900/30 border border-transparent hover:border-indigo-500/50 rounded-lg p-3 cursor-pointer transition-all duration-200 shadow-sm"
                            onClick={() => handleHistoryClick(item)}
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <span className="font-bold text-indigo-300 text-sm">{item.reference}</span>
                                <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                                    {item.version.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-gray-300 text-xs line-clamp-2 leading-relaxed">
                                "{item.text}"
                            </p>
                            
                            {/* Hover Overlay Action */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg backdrop-blur-[1px]">
                                <div className="bg-indigo-600 text-white flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-xl transform scale-95 group-hover:scale-100 transition-transform">
                                    <Play size={12} fill="currentColor" />
                                    Proyectar
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RecentBibleHistory;
