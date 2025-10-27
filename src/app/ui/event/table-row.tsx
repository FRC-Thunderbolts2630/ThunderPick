'use client';

import clsx from 'clsx';
import { useState, memo } from "react";
import { PicklistSchema2025, CSVRowData } from "@/app/lib/types";

// Helper function: interpolate from muted red to soft green with comfortable gradient
function getHeatmapColor(normalizedValue: number): string {
    // Clamp value between 0 and 1
    const t = Math.max(0, Math.min(1, normalizedValue));

    let r: number, g: number, b: number;

    if (t < 0.5) {
        // Muted red to soft yellow transition (first half)
        const localT = t * 2; // 0 to 1
        r = 180; // Softer red
        g = 60 + Math.round(localT * 100); // 60 to 160 (muted yellow)
        b = 60; // Base blue for less saturation
    } else {
        // Soft yellow to muted green (second half)
        const localT = (t - 0.5) * 2; // 0 to 1
        r = 180 - Math.round(localT * 120); // 180 to 60
        g = 160 + Math.round(localT * 20); // 160 to 180 (softer green)
        b = 60 + Math.round(localT * 10); // 60 to 70 (slight variation)
    }

    return `rgb(${r}, ${g}, ${b})`;
}

const TableRow = memo(function TableRow({
    data,
    selectedBranch,
    addTeam,
    removeTeam,
    currentlyActive,
    isDragging,
    fields,
    isCSVMode = false,
    updatePicklistOrder,
    columnStats = {},
    computedColumns = []
}: {
    data: PicklistSchema2025 | CSVRowData,
    selectedBranch: string,
    addTeam: (team: number) => void,
    removeTeam: (team: number) => void,
    currentlyActive: boolean,
    isDragging: boolean,
    fields?: string[],
    isCSVMode?: boolean,
    updatePicklistOrder?: (teamNumber: number, newOrder: number) => void,
    columnStats?: { [key: string]: { min: number; max: number } },
    computedColumns?: Array<{ name: string; formula: string; type: 'numeric' | 'boolean' }>
}) {
    // Initialize isActive based on picklistOrder: 999 means inactive (checkbox checked)
    const [isActive, setActive] = useState(
        isCSVMode && 'picklistOrder' in data
            ? data.picklistOrder !== 999
            : currentlyActive
    );
    const [originalPicklistOrder, setOriginalPicklistOrder] = useState<number | null>(null);

    const changeActiveness = (value: boolean) => {
        setActive(value);

        if (value) {
            // Team is becoming active (checkbox unchecked)
            addTeam(data["teamNumber"]);
            // Restore original picklist order if we have one stored
            if (originalPicklistOrder !== null && updatePicklistOrder) {
                updatePicklistOrder(data.teamNumber, originalPicklistOrder);
                setOriginalPicklistOrder(null);
            }
        }
        else {
            // Team is becoming inactive (checkbox checked - red X shows)
            removeTeam(data["teamNumber"]);
            // Store current picklist order and set to 999
            if (updatePicklistOrder && 'picklistOrder' in data) {
                setOriginalPicklistOrder(data.picklistOrder || 0);
                updatePicklistOrder(data.teamNumber, 999);
            }
        }
    }

    const isDisabled = () => {
        return !isActive || data["teamNumber"]
    }

    // Dynamic column rendering for CSV mode
    const renderDynamicColumns = () => {
        if (!fields) return null;

        // Check if rank column exists to determine shadow placement
        const hasRankColumn = fields.some(f => f.toLowerCase() === 'rank');

        return fields.map((fieldName) => {
            // Special handling for Picklist Order - make it editable
            if (fieldName === 'Picklist Order') {
                const csvData = data as CSVRowData;
                return (
                    <div key={fieldName + data.teamNumber}
                         className="flex items-center justify-center min-w-[136px] w-[136px] h-full border-l border-gray-500/50 md:h-auto md:border-none sticky left-[60px] z-10"
                         style={{ minHeight: '56px', backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.2)' : '#0f172a' }}>
                        <input
                            type="number"
                            value={csvData.picklistOrder || 0}
                            onChange={(e) => {
                                const newOrder = parseInt(e.target.value);
                                if (!isNaN(newOrder) && updatePicklistOrder) {
                                    updatePicklistOrder(data.teamNumber, newOrder);
                                }
                            }}
                            className={clsx(
                                "w-16 h-8 text-center text-lg md:text-sm lg:text-base px-2 md:px-1 bg-gray-700/50 border border-gray-500/50 rounded focus:border-blue-500 focus:outline-none",
                                { "text-gray-500 bg-gray-800/50" : !isActive }
                            )}
                            disabled={!isActive}
                        />
                    </div>
                );
            }

            // Special handling for Team - map to teamNumber
            if (fieldName === 'Team') {
                // Apply shadow if Team is the last frozen column (no rank exists)
                const teamClassName = hasRankColumn
                    ? "flex items-center justify-center min-w-[140px] w-[140px] h-full border-l border-gray-500/50 md:h-auto md:border-none sticky left-[196px] z-10"
                    : "flex items-center justify-center min-w-[140px] w-[140px] h-full border-l border-gray-500/50 md:h-auto md:border-none sticky left-[196px] z-10 shadow-[2px_0_4px_rgba(0,0,0,0.3)]";
                return (
                    <div key={fieldName + data.teamNumber}
                         className={teamClassName}
                         style={{ minHeight: '56px', backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.2)' : '#0f172a' }}>
                        <p className={clsx("text-lg md:text-sm lg:text-base", { "text-gray-500" : !isActive })} suppressHydrationWarning>{data.teamNumber}</p>
                    </div>
                );
            }

            // Special handling for Rank - frozen column, no heatmap
            if (fieldName.toLowerCase() === 'rank') {
                // Convert field name to potential data key
                const dataKey = fieldName.toLowerCase().replace(/\s+/g, '');
                let value = data[dataKey as keyof typeof data];

                // Try to find the value with exact match first
                if (value === undefined) {
                    const matchingKey = Object.keys(data).find(
                        key => key.toLowerCase() === fieldName.toLowerCase().replace(/\s+/g, '')
                    );
                    if (matchingKey) {
                        value = data[matchingKey as keyof typeof data];
                    }
                }

                // Format the value as integer (no decimals)
                let displayValue: string | number = value;
                if (typeof value === 'number') {
                    displayValue = Math.round(value).toString();
                } else if (value === undefined || value === null) {
                    displayValue = '-';
                }

                return (
                    <div key={fieldName + data.teamNumber}
                         className="flex items-center justify-center min-w-[140px] w-[140px] h-full border-l border-gray-500/50 md:h-auto md:border-none sticky left-[336px] z-10 shadow-[2px_0_4px_rgba(0,0,0,0.3)]"
                         style={{ minHeight: '56px', backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.2)' : '#0f172a' }}>
                        <p className={clsx("text-lg md:text-sm lg:text-base", { "text-gray-500" : !isActive })} suppressHydrationWarning>{displayValue as string}</p>
                    </div>
                );
            }

            // Convert field name to potential data key
            const dataKey = fieldName.toLowerCase().replace(/\s+/g, '');
            let value = data[dataKey as keyof typeof data];

            // Try to find the value with exact match first
            if (value === undefined) {
                // Try to match by checking all keys
                const matchingKey = Object.keys(data).find(
                    key => key.toLowerCase() === fieldName.toLowerCase().replace(/\s+/g, '')
                );
                if (matchingKey) {
                    value = data[matchingKey as keyof typeof data];
                }
            }

            // Format the value
            let displayValue = value;
            if (typeof value === 'number') {
                displayValue = value.toFixed(2);
            } else if (value === undefined || value === null) {
                displayValue = '-';
            }

            // Check if this is a boolean computed column
            const isBooleanColumn = computedColumns.some(
                col => col.name === fieldName && col.type === 'boolean'
            );

            // Calculate heatmap color for numeric columns (exclude boolean columns)
            let bgColor: string | undefined;
            const isHeatmapCell = typeof value === 'number' && columnStats[fieldName] && !isBooleanColumn;

            if (isHeatmapCell && typeof value === 'number') {
                const { min, max } = columnStats[fieldName];
                if (max !== min) {
                    // Normalize value to 0-1 range
                    const normalized = (value - min) / (max - min);
                    bgColor = getHeatmapColor(normalized);
                }
            }

            return (
                <div
                    key={fieldName + data.teamNumber}
                    className={clsx(
                        "flex items-center justify-center p-0",
                        isHeatmapCell ? "min-w-[160px] w-[160px] h-full border border-gray-900/30 box-border" : "min-w-[160px] w-[160px] h-full border-l border-gray-500/50 md:h-auto md:border-none"
                    )}
                    style={bgColor ? { backgroundColor: bgColor, boxSizing: 'border-box', minHeight: '56px' } : { minHeight: '56px' }}
                >
                    <p
                        className={clsx(
                            isHeatmapCell
                                ? "text-base font-bold text-white font-mono"
                                : "text-lg md:text-sm lg:text-base",
                            {
                                "text-gray-500": !isActive && !isHeatmapCell
                            }
                        )}
                        suppressHydrationWarning
                    >
                        {displayValue as string}
                    </p>
                </div>
            );
        });
    };

    // Legacy column rendering for PicklistSchema2025
    const renderLegacyColumns = () => {
        const picklist2025Data = data as PicklistSchema2025;
        const branchKey = `coral${selectedBranch}`;

        const filteredData = {
            "teamNumber": picklist2025Data.teamNumber.toFixed(2),
            "totalEpa": picklist2025Data.totalEpa.toFixed(2),
            "autoEpa": picklist2025Data.autoEpa.toFixed(2),
            "teleopEpa": picklist2025Data.teleopEpa.toFixed(2),
            "totalCoralInAuto": picklist2025Data.totalCoralInAuto.toFixed(2),
            "coralOnBranch": picklist2025Data[branchKey as "coralL1" | "coralL2" | "coralL3" | "coralL4"].toFixed(2),
            "totalAlgaeInNet": picklist2025Data.totalAlgaeInNet.toFixed(2),
            "endgamePoints": picklist2025Data.endgamePoints.toFixed(2)
        };

        return Object.entries(filteredData)
            .filter(([property, _]) => !(["teamNumber", "autoEpa", "teleopEpa"].includes(property)))
            .map(([name, value]) => (
                <div key={name + data.teamNumber} className={`flex items-center ${name == "coralOnBranch" ? 'w-[40vw]' : 'w-[35vw]'} md:w-1/6 h-14 border-l border-gray-500/50 md:h-auto md:border-none`}>
                    <p className={clsx("text-lg md:text-sm lg:text-base ml-4 md:ml-0 px-2 md:px-0", { "text-gray-500" : !isActive })} suppressHydrationWarning>{value}</p>
                </div>
            ));
    };

    return (
        <div key={data["teamNumber"]} className={`flex flex-row items-center justify-start ${isCSVMode ? '' : 'gap-3'} mx-auto ${isCSVMode ? 'w-max bg-slate-900' : 'w-[240vw] overflow-visible md:w-full'} h-14 border-b border-gray-500/50 mr-2 md:mr-0 overscroll-none ${isDragging ? 'bg-blue-600/20 border-[1.5px] border-b-[1.5px] border-blue-600 rounded-md' : ''}`}>
            <div className={clsx('relative flex items-center justify-center', {
                'sticky left-0 z-20 h-full': isCSVMode,
                'w-4 h-4': !isCSVMode
            })}
                 style={isCSVMode ? { width: '60px', minHeight: '56px', backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.2)' : '#0f172a' } : undefined}>
                <input
                    type="checkbox"
                    checked={!isActive}
                    className={clsx('peer appearance-none w-4 h-4 bg-gray-500 bg-opacity-50 border-2 border-gray-500 rounded-sm cursor-pointer focus:ring-0 checked:bg-red-400/25 checked:border-red-400/50', {
                        'ml-4': !isCSVMode
                    })}
                    onChange={(event) => changeActiveness(!event.target.checked)}/>
                <svg
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none hidden peer-checked:block stroke-red-400 outline-none"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
            </div>
            <div className={`flex flex-row items-center ${isCSVMode ? 'justify-start' : 'justify-between w-full ml-6 md:ml-16'}`}>
                {isCSVMode ? renderDynamicColumns() : renderLegacyColumns()}
            </div>
        </div>
    );
});

export default TableRow;