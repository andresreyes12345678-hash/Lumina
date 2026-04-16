import React from 'react';
import SongsPanel from './SongsPanel';
import BiblePanel from './BiblePanel';
import MediaPanel from './MediaPanel';
import { useStore } from '../../store/useStore';
import { Music, Book, Film } from 'lucide-react';

type TabType = 'songs' | 'bible' | 'media';

const LibraryTabs: React.FC = () => {
    const { activeTab, setActiveTab } = useStore();

    const tabs = [
        { id: 'songs' as TabType, label: 'Canciones', icon: Music },
        { id: 'bible' as TabType, label: 'Biblia', icon: Book },
        { id: 'media' as TabType, label: 'Medios', icon: Film },
    ];

    return (
        <div className="h-full flex flex-col">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-700 bg-zinc-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
              flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors
              ${activeTab === tab.id
                                ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-900'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-zinc-800/50'
                            }
            `}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'songs' && <SongsPanel />}
                {activeTab === 'bible' && <BiblePanel />}
                {activeTab === 'media' && <MediaPanel />}
            </div>
        </div>
    );
};

export default LibraryTabs;
