import React, { useEffect, useState } from 'react';
import { Slide } from '../../types';
import { Monitor } from 'lucide-react';
import { useStore } from '../../store/useStore';
import ScalableSlide from '../Shared/ScalableSlide';

const LivePreview: React.FC = () => {
    const [previewSlide, setPreviewSlide] = useState<Slide | null>(null);
    const { reportVideoStatus, isProjectionActive, toggleProjection } = useStore();

    useEffect(() => {
        // Listen for preview updates from main process
        if (window.electronAPI) {
            window.electronAPI.onUpdatePreview((slideData) => {
                setPreviewSlide(slideData);
            });
        }
    }, []);

    const handlePlaybackUpdate = (state: { currentTime: number; duration: number; isPlaying: boolean }) => {
        // Report status to store WITHOUT triggering IPC loop
        reportVideoStatus?.(state);
    };

    return (
        <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Monitor size={18} className="text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-300">Live Preview</h3>
                </div>
                
                <button
                    onClick={toggleProjection}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        isProjectionActive 
                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30' 
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                    }`}
                    title={isProjectionActive ? 'Apagar Proyección' : 'Encender Proyección'}
                >
                    {isProjectionActive ? (
                        <>
                            <Monitor size={14} />
                            <span>ON</span>
                        </>
                    ) : (
                        <>
                            {/* Import MonitorOff locally for simplicity or assume it's exposed. Wait, I should add it to imports */}
                            <Monitor size={14} className="opacity-50 line-through" /> 
                            <span>OFF</span>
                        </>
                    )}
                </button>
            </div>

            {/* 16:9 Preview Box */}
            <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-700 relative group">
                {/* muted={true}: Audio plays ONLY from the Stage (projection) window, never from preview */}
                <ScalableSlide
                    slide={previewSlide}
                    onPlaybackUpdate={handlePlaybackUpdate}
                    muted={true}
                />
            </div>
        </div>
    );
};


export default LivePreview;
