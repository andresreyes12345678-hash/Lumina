import React from 'react';
import { useStore } from '../../store/useStore';
import { FileText, Image as ImageIcon, Power } from 'lucide-react';

const ControlPanel: React.FC = () => {
    const { activeSlide, setActiveSlide, mediaLayerVisible, clearMediaLayer, blackout, textLayerVisible } = useStore();

    // Logic: Clear Active Slide (Deselects and removes border)
    const handleClearSelection = () => {
        setActiveSlide(null);
    };

    const handleMediaToggle = () => {
        clearMediaLayer();
    };

    const handleBlackout = () => {
        blackout();
    };

    const isBlackout = !textLayerVisible && !mediaLayerVisible;

    // Unified Styles
    const baseBtnClass = "group relative flex items-center justify-center transition-all duration-200 border flex-1 h-12";
    const activeBtnClass = "bg-zinc-100 border-white text-zinc-900 shadow-[0_0_10px_rgba(255,255,255,0.3)]";
    const inactiveBtnClass = "bg-zinc-800 border-zinc-700 text-zinc-500 hover:bg-zinc-750 hover:text-zinc-400";

    // Status checks
    // Visible only if we have a slide AND the text layer is actually visible.
    // This ensures that if we hit Blackout, this button looks "OFF" too.
    const isSlideActive = !!activeSlide && textLayerVisible;

    return (
        <div className="px-4 pb-2">
            <div className="flex gap-0">
                {/* 1. Clear Slide (Text/Content) */}
                <button
                    onClick={handleClearSelection}
                    className={`
                        ${baseBtnClass} rounded-l-lg border-r-0 h-9
                        ${isSlideActive ? activeBtnClass : inactiveBtnClass}
                    `}
                    title="Borrar diapositiva"
                >
                    <FileText size={16} />
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        {isSlideActive ? 'Borrar diapositiva' : 'Sin diapositiva'}
                    </span>
                </button>

                {/* 2. Background Toggle */}
                <button
                    onClick={handleMediaToggle}
                    className={`
                        ${baseBtnClass} border-r-0 h-9
                        ${mediaLayerVisible ? activeBtnClass : inactiveBtnClass}
                    `}
                    title="Borrar fondo"
                >
                    <ImageIcon size={16} className={!mediaLayerVisible ? 'opacity-50' : ''} />
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        {mediaLayerVisible ? 'Borrar fondo' : 'Sin fondo'}
                    </span>
                </button>

                {/* 3. Blackout */}
                <button
                    onClick={handleBlackout}
                    className={`
                        ${baseBtnClass} rounded-r-lg h-9
                        ${isBlackout ? activeBtnClass : inactiveBtnClass}
                    `}
                    title="Borrar todo (Blackout)"
                >
                    <Power size={16} />
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        {isBlackout ? 'Todo borrado' : 'Borrar todo'}
                    </span>
                </button>
            </div>
        </div>
    );
};

export default ControlPanel;
