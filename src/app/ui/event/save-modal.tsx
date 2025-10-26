"use client";

import { PicklistSchema2025 } from "@/app/lib/types";
import { rethinkSans } from "@/app/ui/fonts";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import { FormEvent, useState } from "react";
import { savePicklistToStorage } from "./saved-picklists-sidebar";

export default function SaveModal({
    data,
    fields,
    sortOrder,
    sortDirection,
    computedColumns,
    setModalStatus,
    setAlertInfo,
    onSaveComplete
} : {
    data: PicklistSchema2025[] | any[],
    fields?: string[],
    sortOrder?: string,
    sortDirection?: 'asc' | 'desc',
    computedColumns?: Array<{ name: string; formula: string }>,
    setModalStatus: (state: boolean) => void,
    setAlertInfo: (state: [string, string]) => void,
    onSaveComplete?: () => void
}) {
    const [picklistName, setPicklistName] = useState("");

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        if (!picklistName) {
            alert("Please enter a picklist name.");
            return;
        }

        // Validate name (no spaces)
        if (picklistName.includes(' ')) {
            alert("Picklist name cannot contain spaces.");
            return;
        }

        // Save to localStorage
        const success = savePicklistToStorage(
            picklistName,
            data,
            fields || [],
            sortOrder || 'Picklist Order',
            sortDirection || 'asc',
            computedColumns
        );

        if (success) {
            setAlertInfo(["Success", `Picklist "${picklistName}" saved successfully!`]);
            setModalStatus(false);
            if (onSaveComplete) {
                onSaveComplete();
            }
        } else {
            setAlertInfo(["Error", "Failed to save picklist. Please try again."]);
        }
    };

    return (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[6px]">
            <div className="relative flex flex-col items-center justify-center w-5/6 md:w-1/3 h-1/3 bg-slate-800/80 md:bg-slate-800/75 backdrop-blur-[60px] md:backdrop-blur-2xl rounded-xl border-2 border-blue-600/50 gap-4">
                <div className="w-5/6">
                    <h1 className={`${rethinkSans.className} antialiased font-extrabold text-3xl md:text-4xl`} style={{ color: '#228B22', textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}>Save Picklist</h1>
                </div>
                <form className="w-5/6" onSubmit={handleSubmit}>
                    <label htmlFor="picklistName" className="text-xs md:text-sm">Enter picklist name (no spaces)</label>
                    <input 
                        name="picklistName" 
                        className="w-full h-12 rounded-md bg-slate-800 mt-1 border border-slate-600 px-4 focus:outline-none text-[16px] md:text-base"
                        placeholder="Picklist name" 
                        onChange={(event) => setPicklistName(event.target.value)} />
                    <button type="submit" className="flex flex-row items-center justify-center gap-2 w-full h-12 rounded-md mt-4 font-extrabold text-base md:text-lg transition-colors" style={{ backgroundColor: '#006400', color: '#FFFFFF' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#228B22'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#006400'}>
                        <p>Save Picklist</p>
                        <PaperAirplaneIcon className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </form>
                <button className="absolute w-8 h-8 right-4 top-4" onClick={() => setModalStatus(false)}>
                    <XMarkIcon className="w-7 h-7 md:w-8 md:h-8 text-slate-400 hover:text-slate-200" />
                </button>
            </div>
        </div>
    )
}