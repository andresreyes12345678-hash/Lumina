import React from 'react';
import { useStore } from '../../store/useStore';
import { Slide, TYPE_HOTKEYS, SlideType } from '../../types';
import ScalableSlide from '../Shared/ScalableSlide';

interface SlideCardProps {
    slide: Slide;
    index: number;
    onContextMenu: (e: React.MouseEvent) => void;
    isSelected?: boolean;
    inheritedType?: SlideType | null;
    isAnchor?: boolean;
}

const SlideCard: React.FC<SlideCardProps> = ({ slide, index, onContextMenu, isSelected, inheritedType, isAnchor }) => {
    const { activeSlide } = useStore();
    const isActive = activeSlide?.id === slide.id;

    // We allow the parent logic to handle clicks if it wrapped the component
    // BUT since we are passing `onClick` in the parent div in ProductionGrid,
    // we don't need `onClick = { handleClick }` here anymore, OR we keep it for fallback.
    // The parent `div` has `onClick` which calls `handleSlideClick` (Live or Toggle).
    // So we remove internal `onClick` or make it purely visual pass-through.
    // However, existing behavior expects clicking the card triggers selection.

    // Actually, `ProductionGrid` wraps `SlideCard` in a div with onClick.
    // So we should remove `onClick` here to avoid double triggering or conflict.

    // Determine type to use for coloring: Explicit > Inherited
    const typeToUse = inheritedType || slide.type;

    const getBorderColor = (): string => {
        if (!typeToUse || typeof typeToUse !== 'string') return 'border-gray-800 bg-gray-900';

        const t = typeToUse;
        if (t.startsWith('verso')) return 'border-blue-500 bg-gray-800'; // Blue for Verses
        if (t.startsWith('coro')) return 'border-red-500 bg-gray-800';   // Red for Chorus
        if (t.startsWith('puente')) return 'border-green-500 bg-gray-800'; // Green for Bridges
        if (t === 'intro' || t === 'final') return 'border-yellow-500 bg-gray-800'; // Yellow for Intro/End

        return 'border-gray-500 bg-gray-800'; // Default typed
    };

    const borderColor = getBorderColor();

    // Hotkey ONLY shows if it is an Explicit Anchor
    const hotkey = (isAnchor && slide.type) ? TYPE_HOTKEYS[slide.type] : null;

    const getBadgeColor = (): string => {
        if (!typeToUse) return 'bg-zinc-700 text-white';
        const t = typeToUse;
        if (t.startsWith('verso')) return 'bg-blue-600 text-white';
        if (t.startsWith('coro')) return 'bg-red-600 text-white';
        if (t.startsWith('puente')) return 'bg-green-600 text-white';
        if (t === 'intro' || t === 'final') return 'bg-yellow-500 text-black';
        return 'bg-zinc-700 text-white';
    };

    return (
        <div
            onContextMenu={onContextMenu}
            className={`
        relative aspect-video rounded-lg overflow-hidden cursor-pointer bg-black
        transition-all duration-75 border-4
        ${borderColor}
        ${isActive
                    ? 'ring-4 ring-white ring-opacity-100 scale-105 border-transparent z-10 shadow-xl'
                    : isSelected
                        ? 'ring-4 ring-cyan-400 ring-opacity-100 scale-100 border-transparent z-0'
                        : 'hover:scale-102 hover:border-gray-400'
                }
`}
        >
            {/* Master Canvas Rendering */}
            <div className="absolute inset-0 pointer-events-none">
                <ScalableSlide slide={slide} />
            </div>

            {/* Overlays (Hotkeys, Badges) remain on top of the canvas */}

            {/* Hotkey Badge */}
            {hotkey && (
                <div className="absolute top-2 right-2 z-20">
                    <div className={`
w - 7 h - 7 rounded - md flex items - center justify - center
text - xs font - bold shadow - lg border border - white / 20
            ${getBadgeColor()}
`}>
                        {hotkey}
                    </div>
                </div>
            )}

            {/* Index Badge */}
            <div className="absolute bottom-2 left-2 z-20">
                <div className="bg-black/60 px-2 py-1 rounded text-white text-xs">
                    #{index + 1}
                </div>
            </div>

            {/* Active Indicator (White Border / Overlay) */}
            {isActive && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                    <div className="w-full h-full border-4 border-white rounded-lg" />
                </div>
            )}

            {/* Selection Indicator for Edit Mode */}
            {/* If Active AND Selected: Show Inner Blue Border */}
            {isSelected && isActive && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                    <div className="w-full h-full border-[6px] border-cyan-400/80 rounded-lg" />
                </div>
            )}

            {/* If Selected ONLY (handled by ring above, but can add overlay for clarity) */}
            {isSelected && !isActive && (
                <div className="absolute inset-0 z-20 pointer-events-none bg-cyan-400/10" />
            )}
        </div>
    );
};

export default SlideCard;
