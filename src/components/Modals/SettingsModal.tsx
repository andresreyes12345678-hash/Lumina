import React, { useState } from 'react';
import { X, Settings2, Database, MonitorUp, Download, Upload } from 'lucide-react';
import { useStore } from '../../store/useStore';
import NdiToggle from '../RightColumn/NdiToggle';
import { Song, SongFolder } from '../../types';

const SettingsModal: React.FC = () => {
    const { isSettingsOpen, setSettingsOpen, songs, songFolders, addSongFolder, addSong } = useStore();
    const [activeTab, setActiveTab] = useState<'ndi' | 'database'>('ndi');

    if (!isSettingsOpen) return null;

    const handleExport = () => {
        try {
            const data = JSON.stringify({ songs, songFolders }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Lumina_Backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert("Error al exportar los datos: " + error);
        }
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    if (!data.songs || !data.songFolders) {
                        throw new Error("El formato del archivo no es válido para Lúmina.");
                    }

                    const importPrefix = `imp-${Date.now()}-`;
                    
                    const importedFolders = data.songFolders.map((f: SongFolder) => ({
                        ...f,
                        id: f.isSystemFolder ? f.id : `${importPrefix}${f.id}`
                    }));

                    const importedSongs = data.songs.map((s: Song) => ({
                        ...s,
                        id: `${importPrefix}${s.id}`,
                        folderId: data.songFolders.find((f: SongFolder) => f.id === s.folderId)?.isSystemFolder 
                                    ? s.folderId 
                                    : `${importPrefix}${s.folderId}`
                    }));

                    importedFolders.forEach((f: SongFolder) => {
                        if (!f.isSystemFolder) {
                            addSongFolder(f);
                        }
                    });

                    importedSongs.forEach((s: Song) => {
                        addSong(s);
                    });

                    alert(`Importación exitosa: ${importedSongs.length} canciones agregadas.`);
                } catch (error: any) {
                    alert("Error al importar: " + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl h-[70vh] flex overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Sidebar */}
                <div className="w-64 bg-zinc-950 border-r border-gray-800 flex flex-col">
                    <div className="p-4 border-b border-gray-800">
                        <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                            <Settings2 size={20} className="text-gray-400" />
                            Configuración
                        </h2>
                    </div>
                    
                    <div className="flex-1 p-2 flex flex-col gap-1">
                        <button
                            onClick={() => setActiveTab('ndi')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                                activeTab === 'ndi' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                        >
                            <MonitorUp size={18} />
                            Transmisión NDI
                        </button>
                        
                        <button
                            onClick={() => setActiveTab('database')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                                activeTab === 'database' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                        >
                            <Database size={18} />
                            Base de Datos
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col bg-zinc-900">
                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                        <h3 className="text-lg font-semibold text-gray-200">
                            {activeTab === 'ndi' && 'Configuración de NDI'}
                            {activeTab === 'database' && 'Respaldo y Transferencia'}
                        </h3>
                        <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                        {activeTab === 'ndi' && (
                            <div className="max-w-xl">
                                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                    Network Device Interface (NDI) permite transmitir de forma nativa la pantalla de proyección (con su canal Alpha de transparencia) a través de tu red local hacia softwares como OBS Studio, vMix o Resolume.
                                </p>
                                <div className="bg-gray-950 p-6 rounded-lg border border-gray-800">
                                    <NdiToggle />
                                </div>
                            </div>
                        )}

                        {activeTab === 'database' && (
                            <div className="max-w-2xl space-y-8">
                                <div>
                                    <h4 className="text-md font-semibold text-gray-200 mb-2">Exportar Canciones</h4>
                                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                                        Descarga un archivo con toda tu biblioteca de canciones y carpetas actuales. Este archivo lo puedes compartir con otro usuario o guardarlo como copia de seguridad.
                                    </p>
                                    <button 
                                        onClick={handleExport}
                                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-gray-200 px-4 py-2 rounded-md font-medium transition-colors border border-gray-600"
                                    >
                                        <Download size={16} />
                                        Exportar Biblioteca (JSON)
                                    </button>
                                </div>
                                
                                <div className="border-t border-gray-800 pt-8">
                                    <h4 className="text-md font-semibold text-gray-200 mb-2">Importar Canciones</h4>
                                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                                        Carga un archivo de respaldo de Lúmina. Las canciones y carpetas se añadirán a tu biblioteca actual sin sobrescribir ni borrar los datos que ya tienes.
                                    </p>
                                    <button 
                                        onClick={handleImport}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-lg shadow-blue-900/20"
                                    >
                                        <Upload size={16} />
                                        Importar Biblioteca (JSON)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
