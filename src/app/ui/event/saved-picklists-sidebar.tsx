'use client';

import { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { rethinkSans } from "@/app/ui/fonts";

interface SavedPicklist {
    name: string;
    data: any[];
    fields: string[];
    sortOrder: string;
    sortDirection: 'asc' | 'desc';
    timestamp: number;
    computedColumns?: Array<{ name: string; formula: string }>;
}

const SAVED_PICKLISTS_KEY = 'thunderpick_saved_picklists';

export default function SavedPicklistsSidebar({
    onLoad,
    onSave
}: {
    onLoad: (picklist: SavedPicklist) => void;
    onSave?: () => void;
}) {
    const [savedPicklists, setSavedPicklists] = useState<SavedPicklist[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    // Load saved picklists from localStorage
    useEffect(() => {
        loadPicklists();
    }, []);

    const loadPicklists = () => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(SAVED_PICKLISTS_KEY);
                if (saved) {
                    const picklists = JSON.parse(saved);
                    setSavedPicklists(picklists);
                }
            } catch (e) {
                console.error('Failed to load saved picklists:', e);
            }
        }
    };

    const deletePicklist = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Delete picklist "${name}"?`)) {
            const updated = savedPicklists.filter(p => p.name !== name);
            localStorage.setItem(SAVED_PICKLISTS_KEY, JSON.stringify(updated));
            setSavedPicklists(updated);
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <>
            {/* Toggle button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed left-4 top-4 z-50 px-3 py-2 rounded-lg font-semibold text-sm transition-colors"
                style={{
                    backgroundColor: isOpen ? '#228B22' : '#006400',
                    color: '#FFFFFF'
                }}
                onMouseEnter={(e) => !isOpen && (e.currentTarget.style.backgroundColor = '#228B22')}
                onMouseLeave={(e) => !isOpen && (e.currentTarget.style.backgroundColor = '#006400')}
            >
                {isOpen ? 'Close' : 'Saved Picklists'} ({savedPicklists.length})
            </button>

            {/* Sidebar */}
            <div
                className={`fixed left-0 top-0 h-screen w-80 bg-slate-800/95 backdrop-blur-xl border-r border-gray-600/50 shadow-2xl z-40 transition-transform duration-300 overflow-y-auto ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="p-6 pt-20">
                    <h2 className={`${rethinkSans.className} text-2xl font-extrabold mb-4`} style={{ color: '#228B22' }}>
                        Saved Picklists
                    </h2>

                    {savedPicklists.length === 0 ? (
                        <p className="text-gray-400 text-sm">No saved picklists yet. Save your first picklist to see it here!</p>
                    ) : (
                        <div className="space-y-2">
                            {savedPicklists.map((picklist) => (
                                <div
                                    key={picklist.name}
                                    className="relative group bg-slate-700/50 hover:bg-slate-700 rounded-lg p-3 cursor-pointer transition-colors border border-gray-600/30 hover:border-gray-500/50"
                                    onClick={() => {
                                        onLoad(picklist);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-white truncate">{picklist.name}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {picklist.data.length} teams • {formatTimestamp(picklist.timestamp)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => deletePicklist(picklist.name, e)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded"
                                            title="Delete picklist"
                                        >
                                            <TrashIcon className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// Export helper function to save a picklist
export function savePicklistToStorage(
    name: string,
    data: any[],
    fields: string[],
    sortOrder: string,
    sortDirection: 'asc' | 'desc',
    computedColumns?: Array<{ name: string; formula: string }>
): boolean {
    try {
        if (typeof window === 'undefined') return false;

        const saved = localStorage.getItem(SAVED_PICKLISTS_KEY);
        const picklists: SavedPicklist[] = saved ? JSON.parse(saved) : [];

        // Check if name already exists
        const existingIndex = picklists.findIndex(p => p.name === name);

        const newPicklist: SavedPicklist = {
            name,
            data,
            fields,
            sortOrder,
            sortDirection,
            timestamp: Date.now(),
            computedColumns
        };

        if (existingIndex >= 0) {
            // Update existing
            picklists[existingIndex] = newPicklist;
        } else {
            // Add new
            picklists.push(newPicklist);
        }

        localStorage.setItem(SAVED_PICKLISTS_KEY, JSON.stringify(picklists));
        return true;
    } catch (e) {
        console.error('Failed to save picklist:', e);
        return false;
    }
}
