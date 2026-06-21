import React, { useRef } from 'react';
import { useStore } from '../../store/useStore';
import {
    Play, Pause, Square,
    RotateCcw, RotateCw, Repeat,
    Volume2, Volume1, VolumeX
} from 'lucide-react';

interface VideoControlsProps {
    slide?: { id: string; isLooping?: boolean;[key: string]: any } | null;
}

const VideoControls: React.FC<VideoControlsProps> = () => {
    const {
        videoPlaybackState,
        setVideoPlaybackState,
        setVolume,
        mediaLayerVisible,
        activeMediaSnapshot
    } = useStore();

    const { isPlaying, currentTime, duration, isLooping = false, volume = 0.8 } = videoPlaybackState;

    // Detect if an image is currently being projected
    const isImageProjecting = mediaLayerVisible && activeMediaSnapshot?.type === 'image';

    // Track last non-zero volume for mute toggle restore
    const lastVolumeRef = useRef<number>(volume > 0 ? volume : 0.8);
    const isMuted = volume === 0;

    // Helper: Format Seconds to MM:SS
    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
        if (isImageProjecting) return;
        setVideoPlaybackState({ isPlaying: !isPlaying });
    };

    const handleStop = () => {
        if (isImageProjecting) return;
        setVideoPlaybackState({ isPlaying: false, currentTime: 0, seekTime: 0 });
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isImageProjecting) return;
        const time = parseFloat(e.target.value);
        setVideoPlaybackState({ currentTime: time, seekTime: time });
    };

    const handleJump = (delta: number) => {
        if (isImageProjecting) return;
        const newTime = Math.max(0, Math.min(duration, currentTime + delta));
        setVideoPlaybackState({ currentTime: newTime, seekTime: newTime });
    };

    const toggleLoop = () => {
        if (isImageProjecting) return;
        const newState = !isLooping;
        setVideoPlaybackState({ isLooping: newState });

        // PERSISTENCE: Save loop preference to the source MediaFile
        const { activeMediaSnapshot: mediaSnapshot, updateMediaFile } = useStore.getState();
        if (mediaSnapshot?.id) {
            updateMediaFile(mediaSnapshot.id, { isLooping: newState });
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isImageProjecting) return;
        const newVolume = parseFloat(e.target.value);
        if (newVolume > 0) lastVolumeRef.current = newVolume;
        setVolume(newVolume);
    };

    const handleMuteToggle = () => {
        if (isImageProjecting) return;
        if (isMuted) {
            // Restore last volume (minimum 0.1)
            setVolume(lastVolumeRef.current || 0.8);
        } else {
            lastVolumeRef.current = volume;
            setVolume(0);
        }
    };

    // Pick volume icon based on level
    const VolumeIcon = isMuted || volume === 0
        ? VolumeX
        : volume < 0.5
            ? Volume1
            : Volume2;

    return (
        <div className="px-4 pt-3 pb-2 space-y-2">
            {/* Time Display */}
            <div className={`flex justify-between items-center text-[10px] font-mono px-1 transition-opacity ${
                isImageProjecting ? 'text-gray-600 opacity-30' : 'text-blue-400'
            }`}>
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
                disabled={isImageProjecting}
                className={`w-full h-1 bg-gray-700 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 accent-blue-500 ${
                    isImageProjecting ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                }`}
            />

            {/* Transport Controls */}
            <div className="flex items-center justify-between">
                {/* Toggle Loop */}
                <button
                    onClick={toggleLoop}
                    disabled={isImageProjecting}
                    className={`p-1.5 rounded transition-colors ${
                        isImageProjecting 
                            ? 'text-gray-605 opacity-30 cursor-not-allowed' 
                            : isLooping 
                                ? 'text-blue-400 bg-blue-400/10' 
                                : 'text-gray-500 hover:text-gray-300'
                    }`}
                    title="Bucle / Loop"
                >
                    <Repeat size={14} />
                </button>

                {/* Main Transport */}
                <div className="flex items-center gap-1.5">
                    <button 
                        onClick={() => handleJump(-5)} 
                        disabled={isImageProjecting}
                        className={`p-1.5 transition-colors relative ${
                            isImageProjecting ? 'text-gray-600 opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'
                        }`} 
                        title="-5s"
                    >
                        <RotateCcw size={16} />
                        <span className="absolute -bottom-1 -right-1 text-[8px] bg-black/50 px-0.5 rounded">5</span>
                    </button>

                    {isPlaying ? (
                        <button 
                            onClick={handlePlayPause} 
                            disabled={isImageProjecting}
                            className={`p-2 rounded-full transition-all shadow-md ${
                                isImageProjecting 
                                    ? 'bg-zinc-800 text-zinc-600 opacity-30 cursor-not-allowed' 
                                    : 'bg-yellow-500 hover:bg-yellow-600 text-black'
                            }`}
                        >
                            <Pause size={16} fill="currentColor" />
                        </button>
                    ) : (
                        <button 
                            onClick={handlePlayPause} 
                            disabled={isImageProjecting}
                            className={`p-2 rounded-full transition-all shadow-md ${
                                isImageProjecting 
                                    ? 'bg-zinc-800 text-zinc-600 opacity-30 cursor-not-allowed' 
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                            <Play size={16} fill="currentColor" className="ml-0.5" />
                        </button>
                    )}

                    <button 
                        onClick={() => handleJump(5)} 
                        disabled={isImageProjecting}
                        className={`p-1.5 transition-colors relative ${
                            isImageProjecting ? 'text-gray-600 opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'
                        }`} 
                        title="+5s"
                    >
                        <RotateCw size={16} />
                        <span className="absolute -bottom-1 -left-1 text-[8px] bg-black/50 px-0.5 rounded">5</span>
                    </button>
                </div>

                {/* Stop */}
                <button 
                    onClick={handleStop} 
                    disabled={isImageProjecting}
                    className={`p-1.5 rounded transition-colors ${
                        isImageProjecting ? 'text-gray-600 opacity-30 cursor-not-allowed' : 'text-red-500 hover:bg-red-500/10'
                    }`} 
                    title="Detener"
                >
                    <Square size={14} fill="currentColor" />
                </button>
            </div>

            {/* Volume Control Row */}
            <div className="flex items-center gap-2 pt-1">
                {/* Mute toggle button */}
                <button
                    onClick={handleMuteToggle}
                    disabled={isImageProjecting}
                    className={`flex-shrink-0 p-1 rounded transition-colors ${
                        isImageProjecting 
                            ? 'text-gray-600 opacity-30 cursor-not-allowed' 
                            : isMuted 
                                ? 'text-red-400 hover:text-red-300' 
                                : 'text-gray-400 hover:text-white'
                    }`}
                    title={isMuted ? 'Activar sonido' : 'Silenciar'}
                >
                    <VolumeIcon size={14} />
                </button>

                {/* Volume Slider */}
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    disabled={isImageProjecting}
                    className={`flex-1 h-1 bg-gray-700 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 accent-blue-400 ${
                        isImageProjecting ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    title={`Volumen: ${Math.round(volume * 100)}%`}
                />

                {/* Volume Percentage */}
                <span className={`flex-shrink-0 text-[10px] font-mono w-8 text-right transition-opacity ${
                    isImageProjecting ? 'text-gray-600 opacity-30' : 'text-gray-500'
                }`}>
                    {Math.round(volume * 100)}%
                </span>
            </div>
        </div>
    );
};

export default VideoControls;
