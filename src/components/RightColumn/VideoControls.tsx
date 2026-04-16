import React from 'react';
import { useStore } from '../../store/useStore';
import {
    Play, Pause, Square,
    RotateCcw, RotateCw, Repeat
} from 'lucide-react';

interface VideoControlsProps {
    slide?: { id: string; isLooping?: boolean;[key: string]: any } | null;
}

const VideoControls: React.FC<VideoControlsProps> = () => {
    const {
        videoPlaybackState,
        setVideoPlaybackState
    } = useStore();

    // Use passed slide (Library) or fallback to Active (Live) -> Only needed for initial props if not using Store
    // const targetSlide = slide || activeSlide; // LEGACY: Replaced by runtime state

    const { isPlaying, currentTime, duration, isLooping = false } = videoPlaybackState;
    // const isLooping = targetSlide?.isLooping || false; // LEGACY: Replaced by runtime state

    // Helper: Format Seconds to MM:SS
    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
        setVideoPlaybackState({ isPlaying: !isPlaying });
    };

    const handleStop = () => {
        setVideoPlaybackState({ isPlaying: false, currentTime: 0, seekTime: 0 }); // Reset to start, preserve loop preference
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setVideoPlaybackState({ currentTime: time, seekTime: time });
    };

    const handleJump = (delta: number) => {
        const newTime = Math.max(0, Math.min(duration, currentTime + delta));
        setVideoPlaybackState({ currentTime: newTime, seekTime: newTime });
    };

    const toggleLoop = () => {
        const newState = !isLooping;
        setVideoPlaybackState({ isLooping: newState });

        // PERSISTENCE: If we are playing a file from the Media Library (Background Layer)
        // we should save this preference to the file itself.
        const { activeMediaSnapshot, updateMediaFile } = useStore.getState();

        // Check if current media matches active snapshot and has an ID
        if (activeMediaSnapshot && activeMediaSnapshot.id) {
            // Optimistic update to store (and disk via side-effect in updateMediaFile)
            console.log('[VideoControls] Persisting loop state for:', activeMediaSnapshot.id, newState);
            updateMediaFile(activeMediaSnapshot.id, { isLooping: newState });

            // Note: We also need to update the snapshot itself so subsequent toggles read correct ID/State?
            // Actually no, snapshot is a "Snapshot". But since we just updated the SOURCE file,
            // next time we click it, it will load correctly.
            // But we should probably update the valid snapshot too if we want to be 100% correct,
            // although 'activeMediaSnapshot' is slightly redundant with 'videoPlaybackState' in this runtime context.
        }
    };

    return (
        <div className="px-4 pt-3 pb-2 space-y-1">
            {/* Header / Time */}
            <div className="flex justify-between items-center text-[10px] text-blue-400 font-mono px-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Seekbar */}
            <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 accent-blue-500 mb-1"
            />

            {/* Transport Controls */}
            <div className="flex items-center justify-between">
                {/* Toggle Loop */}
                <button
                    onClick={toggleLoop}
                    className={`p-1.5 rounded transition-colors ${isLooping ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Bucle / Loop"
                >
                    <Repeat size={14} />
                </button>

                {/* Main Transport */}
                <div className="flex items-center gap-1.5">
                    <button onClick={() => handleJump(-5)} className="p-1.5 text-gray-400 hover:text-white transition-colors relative" title="-5s">
                        <RotateCcw size={16} />
                        <span className="absolute -bottom-1 -right-1 text-[8px] bg-black/50 px-0.5 rounded">5</span>
                    </button>

                    {isPlaying ? (
                        <button onClick={handlePlayPause} className="p-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-full transition-all shadow-md">
                            <Pause size={16} fill="currentColor" />
                        </button>
                    ) : (
                        <button onClick={handlePlayPause} className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-full transition-all shadow-md">
                            <Play size={16} fill="currentColor" className="ml-0.5" />
                        </button>
                    )}

                    <button onClick={() => handleJump(5)} className="p-1.5 text-gray-400 hover:text-white transition-colors relative" title="+5s">
                        <RotateCw size={16} />
                        <span className="absolute -bottom-1 -left-1 text-[8px] bg-black/50 px-0.5 rounded">5</span>
                    </button>
                </div>

                {/* Stop */}
                <button onClick={handleStop} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Detener">
                    <Square size={14} fill="currentColor" />
                </button>
            </div>
        </div>
    );
};

export default VideoControls;
