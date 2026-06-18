import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, AlertCircle, CheckCircle, X } from 'lucide-react';

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

const UpdateNotification: React.FC = () => {
    const [state, setState] = useState<UpdateState>('idle');
    const [progress, setProgress] = useState(0);
    const [version, setVersion] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!window.electronAPI?.updater) return;

        const { updater } = window.electronAPI;

        const unsubs = [
            updater.onChecking(() => {
                setState('checking');
                // Only show visible if we want to bug the user. 
                // We'll keep it silent unless there is an update to avoid annoyance on every startup.
            }),
            updater.onAvailable((info: any) => {
                setState('available');
                setVersion(info.version);
                setVisible(true);
            }),
            updater.onNotAvailable(() => {
                setState('idle');
                setVisible(false);
            }),
            updater.onError((err: string) => {
                // If it's a generic network error in dev, ignore it.
                if (err.includes('dev') || err.toLowerCase().includes('net_err')) return;
                setState('error');
                setErrorMsg(err);
                setVisible(true);
            }),
            updater.onDownloadProgress((prog: any) => {
                setState('downloading');
                setProgress(prog.percent);
                setVisible(true);
            }),
            updater.onDownloaded((info: any) => {
                setState('downloaded');
                setVersion(info.version);
                setVisible(true);
            })
        ];

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, []);

    if (!visible) return null;

    const handleInstall = () => {
        window.electronAPI.updater?.install();
    };

    const handleDismiss = () => {
        setVisible(false);
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    {state === 'checking' && <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />}
                    {state === 'available' && <Download className="w-5 h-5 text-yellow-400 animate-bounce" />}
                    {state === 'downloading' && <Download className="w-5 h-5 text-blue-400" />}
                    {state === 'downloaded' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {state === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                    
                    <span className="font-medium text-zinc-100">
                        {state === 'checking' && 'Buscando...'}
                        {state === 'available' && 'Actualización encontrada'}
                        {state === 'downloading' && 'Descargando actualización...'}
                        {state === 'downloaded' && '¡Actualización lista!'}
                        {state === 'error' && 'Error al actualizar'}
                    </span>
                </div>
                {state !== 'downloading' && state !== 'checking' && (
                    <button onClick={handleDismiss} className="text-zinc-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {state === 'available' && (
                <p className="text-sm text-zinc-400">Descargando Lúmina v{version} en segundo plano...</p>
            )}

            {state === 'downloading' && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                        <span>Lúmina v{version}</span>
                        <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {state === 'downloaded' && (
                <div className="space-y-3">
                    <p className="text-sm text-zinc-400">La versión {version} está lista para instalarse. Lúmina se reiniciará.</p>
                    <button 
                        onClick={handleInstall}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
                    >
                        Reiniciar e Instalar
                    </button>
                </div>
            )}

            {state === 'error' && (
                <p className="text-xs text-red-400 break-words line-clamp-3" title={errorMsg}>{errorMsg}</p>
            )}
        </div>
    );
};

export default UpdateNotification;
