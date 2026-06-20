import React, { useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import packageJson from '../../../package.json';

const AppVersionFooter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const handleCheckUpdate = () => {
        setIsOpen(false);
        if (window.electronAPI?.updater?.check) {
            window.electronAPI.updater.check();
        }
    };

    return (
        <div className="relative border-t border-gray-800 bg-zinc-900 p-1 flex justify-end">
            {isOpen && (
                <div className="absolute bottom-full left-2 mb-2 w-48 bg-zinc-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-700 bg-zinc-900/50">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Lúmina App</p>
                        <p className="text-sm text-gray-200 font-semibold">Versión {packageJson.version}</p>
                    </div>
                    <button
                        onClick={handleCheckUpdate}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <RefreshCw size={14} />
                        Buscar actualizaciones
                    </button>
                </div>
            )}
            
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-800"
                title="Versión y Actualizaciones"
            >
                <Info size={10} />
                v{packageJson.version}
            </button>
            
            {/* Overlay to close dropdown when clicking outside */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default AppVersionFooter;
