import React, { useState, useEffect } from 'react';
import { MonitorUp } from 'lucide-react';

const NdiToggle: React.FC = () => {
    const [isInstalled, setIsInstalled] = useState(false);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        // Check if NDI backend is available
        const checkStatus = async () => {
            if (window.electronAPI && window.electronAPI.getNdiStatus) {
                const status = await window.electronAPI.getNdiStatus();
                setIsInstalled(status.installed);
                setIsActive(status.active);
            }
        };
        checkStatus();
    }, []);

    const toggleNdi = () => {
        if (!isInstalled) return; // shouldn't happen due to UI disable, but just in case
        const nextState = !isActive;
        setIsActive(nextState);
        if (window.electronAPI && window.electronAPI.toggleNdi) {
            window.electronAPI.toggleNdi(nextState);
        }
    };

    return (
        <div className="pt-4 mt-2 border-t border-gray-700">
            <div className="flex items-center gap-2 mb-2">
                <MonitorUp size={16} className={isActive ? "text-green-400" : "text-gray-400"} />
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    Transmisión NDI
                    <span className="text-[9px] bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Próximamente</span>
                </h3>
            </div>
            
            {!isInstalled ? (
                <div className="p-2 bg-gray-800/50 border border-gray-700 rounded text-xs text-gray-400">
                    <p className="mb-1 text-yellow-500/80">⚠️ NDI Tools no detectado o instalado.</p>
                    <p className="text-[10px]">Para habilitar la transparencia con OBS, instala el módulo NPM de NDI y los NewTek Runtimes, luego reinicia Lúmina.</p>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Salida de red (Alpha)</span>
                    <button
                        onClick={toggleNdi}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                            isActive ? 'bg-cyan-600' : 'bg-gray-700'
                        }`}
                    >
                        <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                isActive ? 'translate-x-5' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            )}
        </div>
    );
};

export default NdiToggle;
