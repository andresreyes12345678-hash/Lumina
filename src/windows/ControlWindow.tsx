import React from 'react';
import LibraryTabs from '../components/LeftColumn/LibraryTabs';
import ProductionGrid from '../components/CenterColumn/ProductionGrid';
import LivePreview from '../components/RightColumn/LivePreview';
import PropertiesPanel from '../components/RightColumn/PropertiesPanel';
import LazyEditor from '../components/RightColumn/LazyEditor';
import ControlPanel from '../components/RightColumn/ControlPanel';
import VideoControls from '../components/RightColumn/VideoControls';
import RecentBibleHistory from '../components/RightColumn/RecentBibleHistory';
import { useHotkeys } from '../hooks/useHotkeys';
import { useStore } from '../store/useStore';

const ControlWindow: React.FC = () => {
    // Activate global hotkeys
    useHotkeys();
    const isEditing = useStore(state => state.isEditing);
    const activeTab = useStore(state => state.activeTab);



    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const initData = async () => {
            try {
                // Wait for store to load from Electron/Disk
                await useStore.getState().loadFromStorage();
            } catch (err) {
                console.error('Failed to load initial data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initData();
    }, []);

    // Listen for Auto-End Video (Non-looping)
    React.useEffect(() => {
        if (!window.electronAPI?.onVideoEnded) return;
        const cleanup = window.electronAPI.onVideoEnded(() => {
            useStore.getState().clearMediaLayer();
        });
        return cleanup;
    }, []);

    // Listen for Stage Handshake Re-Sync
    React.useEffect(() => {
        if (!window.electronAPI?.onGetCurrentState) return;
        const cleanup = window.electronAPI.onGetCurrentState(() => {
            useStore.getState().syncStageDisplay();
        });
        return cleanup;
    }, []);

    if (isLoading) {
        return (
            <div className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center select-none cursor-default animation-fade-out">
                <div className="text-center space-y-6 animate-pulse">
                    <h1 className="text-6xl font-bold text-white tracking-widest mb-8 text-shadow-glow">
                        LÚMINA
                    </h1>
                    <div className="space-y-2">
                        <p className="text-gray-400 text-lg font-light tracking-wide">
                            Creado en IPUC Las Delicias - Bogotá
                        </p>
                        <p className="text-red-500/80 text-sm font-medium tracking-wider uppercase border border-red-900/50 px-4 py-1 rounded-full inline-block bg-red-950/20">
                            Prohibido su uso comercial
                        </p>
                    </div>
                </div>
                <div className="absolute bottom-8 text-gray-700 text-xs">
                    Cargando recursos...
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-gray-900 text-gray-100 overflow-hidden">
            {/* 3-Column Layout */}
            <div className="grid grid-cols-[320px_1fr_380px] h-full">
                {/* Left Column - Library & Resources */}
                <div className="bg-zinc-900 border-r border-gray-700 overflow-hidden flex flex-col">
                    <LibraryTabs />
                </div>

                {/* Center Column - Production Grid */}
                <div className="bg-gray-900 overflow-auto">
                    <ProductionGrid />
                </div>

                {/* Right Column - Preview & Properties */}
                <div className="bg-zinc-900 border-l border-gray-700 overflow-auto flex flex-col">
                    {/* Live Preview at top */}
                    <LivePreview />

                    {/* Integrated Controls Block - Always Visible */}
                    <div className="border-t border-gray-700">
                        <VideoControls />
                        <ControlPanel />
                    </div>

                    {/* Conditional: Show Bible History OR (Editor OR Properties Panel) */}
                    {activeTab === 'bible' ? (
                        <RecentBibleHistory />
                    ) : isEditing ? (
                        <LazyEditor />
                    ) : (
                        <PropertiesPanel />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ControlWindow;
