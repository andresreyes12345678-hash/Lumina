import React, { useState, useEffect } from 'react';
import { Info, RefreshCw, CheckCircle2, DownloadCloud, AlertCircle } from 'lucide-react';
import packageJson from '../../../package.json';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'error';

const AppVersionFooter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<UpdateStatus>('idle');

    useEffect(() => {
        if (!window.electronAPI?.updater) return;

        const unsubs = [
            window.electronAPI.updater.onChecking(() => {
                setStatus('checking');
            }),
            window.electronAPI.updater.onAvailable(() => {
                setStatus('available');
            }),
            window.electronAPI.updater.onNotAvailable(() => {
                setStatus('up-to-date');
                setTimeout(() => setStatus('idle'), 4000);
            }),
            window.electronAPI.updater.onError(() => {
                setStatus('error');
                setTimeout(() => setStatus('idle'), 4000);
            })
        ];

        return () => unsubs.forEach(unsub => unsub?.());
    }, []);

    const handleCheckUpdate = () => {
        if (status === 'checking') return;
        
        if (window.electronAPI?.updater?.check) {
            window.electronAPI.updater.check();
        }
    };

    const getStatusContent = () => {
        switch (status) {
            case 'checking':
                return { icon: <RefreshCw size={14} className="animate-spin" />, text: 'Buscando...', color: 'text-blue-400' };
            case 'available':
                return { icon: <DownloadCloud size={14} />, text: '¡Actualización disponible!', color: 'text-green-400' };
            case 'up-to-date':
                return { icon: <CheckCircle2 size={14} />, text: 'Estás al día', color: 'text-gray-400' };
            case 'error':
                return { icon: <AlertCircle size={14} />, text: 'Error al buscar', color: 'text-red-400' };
            default:
                return { icon: <RefreshCw size={14} />, text: 'Buscar actualizaciones', color: 'text-gray-300 group-hover:text-white' };
        }
    };

    const statusContent = getStatusContent();

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
                        disabled={status === 'checking'}
                        className="group w-full text-left px-4 py-3 text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                    >
                        <span className={statusContent.color}>{statusContent.icon}</span>
                        <span className={statusContent.color}>{statusContent.text}</span>
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
