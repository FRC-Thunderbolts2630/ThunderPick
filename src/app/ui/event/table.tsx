'use client';

import TableRow from "@/app/ui/event/table-row";
import { sortDataByStat } from "@/app/lib/data";
import { Branches, PicklistSchema2024, PicklistSchema2025, SortOrder } from "@/app/lib/types";
import { useEffect, useState } from "react";
import * as React from "react";
import { bestAlgaeBot, bestOverallPick, bestCoralBot } from "@/app/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import clsx from 'clsx';

export default function Table({
    data,
    fields,
    sortOrder,
    sortDirection = 'desc',
    isStatic,
    timesSaved,
    picklistName,
    setAlertInfo,
    setBestPick,
    setBestCoralBot,
    setBestAlgaeBot,
    isCSVMode = false,
    onDataChange,
    onColumnSort,
    computedColumns = [],
    onDeleteComputedColumn
}: {
    data: PicklistSchema2025[] | any[],
    fields: string[],
    sortOrder: string,
    sortDirection?: 'asc' | 'desc',
    isStatic: boolean,
    timesSaved: number,
    picklistName?: string,
    setAlertInfo: (state: [string, string]) => void,
    setBestPick: (value: PicklistSchema2025 | any) => void,
    setBestCoralBot: (value: number) => void,
    setBestAlgaeBot: (value: number) => void,
    isCSVMode?: boolean,
    onDataChange?: (data: any[]) => void,
    onColumnSort?: (columnName: string) => void,
    computedColumns?: Array<{ name: string; formula: string; type: 'numeric' | 'boolean' }>,
    onDeleteComputedColumn?: (columnName: string) => void
}) {
    // Hacky solution to update the DragDropContext
    const [newKey, setNewKey] = useState(0);
    const [branch, setBranch] = useState<Branches>("L4");

    const [activeTeams, setActiveTeams] = useState<number[]>(data.map(value => value.teamNumber));
    const [draggedData, setDraggedData] = useState<(PicklistSchema2025 | any)[]>([]);
    const [hasManualOrder, setHasManualOrder] = useState(false);
    const isInternalUpdateRef = React.useRef(false);
    const prevSortOrderRef = React.useRef(sortOrder);
    const prevSortDirectionRef = React.useRef(sortDirection);

    useEffect(() => {
        // Skip re-sorting if this is an internal update (picklistOrder edit or checkbox change)
        if (isInternalUpdateRef.current) {
            isInternalUpdateRef.current = false;
            return;
        }

        // Check if sortOrder or sortDirection changed (user clicked a header)
        const sortChanged = prevSortOrderRef.current !== sortOrder || prevSortDirectionRef.current !== sortDirection;

        // Update refs for next comparison
        prevSortOrderRef.current = sortOrder;
        prevSortDirectionRef.current = sortDirection;

        // If user clicked a header to sort, clear manual order flag to allow sorting
        if (sortChanged && hasManualOrder) {
            setHasManualOrder(false);
        }

        if (!isStatic) {
            if (isCSVMode) {
                // If user has manually reordered rows and sort params haven't changed, preserve that order
                if (hasManualOrder && draggedData.length > 0 && !sortChanged) {
                    // Update existing rows with new data while preserving order
                    const updatedData = draggedData.map(row => {
                        const matchingNewData = data.find(d => d.teamNumber === row.teamNumber);
                        return matchingNewData || row;
                    });
                    setDraggedData(updatedData);
                } else {
                    // Sort CSV data dynamically
                    const sortKey = sortOrder.toLowerCase().replace(/\s+/g, '');
                    const sorted = [...data].sort((a, b) => {
                        // Find matching key case-insensitively
                        const matchingKeyA = Object.keys(a).find(
                            key => key.toLowerCase() === sortKey
                        );
                        const matchingKeyB = Object.keys(b).find(
                            key => key.toLowerCase() === sortKey
                        );

                        const aVal = matchingKeyA ? a[matchingKeyA as keyof typeof a] : undefined;
                        const bVal = matchingKeyB ? b[matchingKeyB as keyof typeof b] : undefined;

                        // Handle numeric sorting
                        if (typeof aVal === 'number' && typeof bVal === 'number') {
                            // Apply sort direction
                            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                        }

                        // Handle string sorting
                        return sortDirection === 'asc'
                            ? String(aVal).localeCompare(String(bVal))
                            : String(bVal).localeCompare(String(aVal));
                    });
                    setDraggedData(sorted);
                    // Clear manual order flag after sorting
                    setHasManualOrder(false);
                }
            } else {
                setDraggedData(sortDataByStat(data as PicklistSchema2025[], sortOrder as SortOrder, branch));
            }
        }
        else {
            setDraggedData(data);
        }

        setNewKey(newKey + 1);
    }, [sortOrder, sortDirection, data, isStatic, isCSVMode, branch]);

    // Handle picklist order updates and sync to parent
    const updatePicklistOrder = (teamNumber: number, newOrder: number) => {
        setDraggedData(prevData => {
            const updatedData = prevData.map(team =>
                team.teamNumber === teamNumber
                    ? { ...team, picklistOrder: newOrder }
                    : team
            );

            // Mark this as an internal update to prevent re-sorting
            isInternalUpdateRef.current = true;

            // Sync the updated data back to parent immediately
            if (onDataChange) {
                onDataChange(updatedData);
            }

            return updatedData;
        });
    };

    useEffect(() => {
        if (isCSVMode) {
            // For CSV mode, calculate best picks based on specific criteria
            const activeData = draggedData.filter(d => activeTeams.includes(d.teamNumber));
            if (activeData.length > 0) {
                // Best pick = team with lowest Picklist Order value
                const bestPickTeam = activeData.reduce((prev, current) => {
                    const prevOrder = prev.picklistOrder || Infinity;
                    const currOrder = current.picklistOrder || Infinity;
                    return currOrder < prevOrder ? current : prev;
                });
                setBestPick(bestPickTeam);

                // Best coral bot = team with highest total teleop coral
                const coralKey = Object.keys(activeData[0] || {}).find(
                    key => key.toLowerCase().includes('coral') && key.toLowerCase().includes('teleop')
                );
                if (coralKey) {
                    const bestCoral = activeData.reduce((prev, current) => {
                        const prevVal = typeof prev[coralKey as keyof typeof prev] === 'number'
                            ? prev[coralKey as keyof typeof prev] as number : -Infinity;
                        const currVal = typeof current[coralKey as keyof typeof current] === 'number'
                            ? current[coralKey as keyof typeof current] as number : -Infinity;
                        return currVal > prevVal ? current : prev;
                    });
                    setBestCoralBot(bestCoral.teamNumber);
                } else {
                    setBestCoralBot(bestPickTeam.teamNumber);
                }

                // Best algae bot = team with highest total algae net
                const algaeKey = Object.keys(activeData[0] || {}).find(
                    key => key.toLowerCase().includes('algae') && key.toLowerCase().includes('net')
                );
                if (algaeKey) {
                    const bestAlgae = activeData.reduce((prev, current) => {
                        const prevVal = typeof prev[algaeKey as keyof typeof prev] === 'number'
                            ? prev[algaeKey as keyof typeof prev] as number : -Infinity;
                        const currVal = typeof current[algaeKey as keyof typeof current] === 'number'
                            ? current[algaeKey as keyof typeof current] as number : -Infinity;
                        return currVal > prevVal ? current : prev;
                    });
                    setBestAlgaeBot(bestAlgae.teamNumber);
                } else {
                    setBestAlgaeBot(bestPickTeam.teamNumber);
                }
            }
        } else {
            setBestPick(bestOverallPick(draggedData as PicklistSchema2025[], activeTeams));
            setBestCoralBot(bestCoralBot(draggedData as PicklistSchema2025[], activeTeams));
            setBestAlgaeBot(bestAlgaeBot(draggedData as PicklistSchema2025[], activeTeams));
        }
    }, [newKey, draggedData, activeTeams, isCSVMode]);

    // Save teams to picklist 
    useEffect(() => {
        const saveData = async () => {
            const payload = {
                name: picklistName,
                data: draggedData,
                static: true
            };

            const response = await fetch("/api/updatePicklist", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setAlertInfo(["Success", "New picklist order saved successfully"]);
            }
        }
        
        if (timesSaved > 0) {
            saveData()
                .catch(e => console.error(e));
        }
            
    }, [timesSaved]);

    const addTeam = (team: number) => {
        setActiveTeams(prev => [...prev, team]);
    };

    const removeTeam = (team: number) => {
        setActiveTeams(prev => prev.filter(value => value !== team));
    };

    const handleOnDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const reorderedData = Array.from(draggedData);
        const [removed] = reorderedData.splice(result.source.index, 1);
        reorderedData.splice(result.destination.index, 0, removed);

        setDraggedData(reorderedData);
        setHasManualOrder(true); // Mark that user has manually reordered rows

        // Mark this as an internal update to prevent re-sorting
        isInternalUpdateRef.current = true;

        // Sync the reordered data back to parent immediately
        if (onDataChange) {
            onDataChange(reorderedData);
        }
    };

    // Calculate min/max for each numeric column for heatmap
    const columnStats = React.useMemo(() => {
        if (!isCSVMode || draggedData.length === 0) return {};

        const stats: { [key: string]: { min: number; max: number } } = {};

        fields.forEach(fieldName => {
            // Skip non-heatmap columns (structural columns + rank)
            const lowerFieldName = fieldName.toLowerCase();
            if (fieldName === 'Picklist Order' ||
                fieldName === 'Team' ||
                lowerFieldName === 'rank' ||
                lowerFieldName.includes('rank')) {
                return;
            }

            // Skip boolean computed columns
            const isBooleanColumn = computedColumns.some(
                col => col.name === fieldName && col.type === 'boolean'
            );
            if (isBooleanColumn) {
                return;
            }

            const dataKey = fieldName.toLowerCase().replace(/\s+/g, '');
            const values: number[] = [];

            draggedData.forEach(row => {
                const matchingKey = Object.keys(row).find(
                    key => key.toLowerCase() === dataKey
                );
                if (matchingKey) {
                    const value = row[matchingKey as keyof typeof row];
                    if (typeof value === 'number' && !isNaN(value)) {
                        values.push(value);
                    }
                }
            });

            if (values.length > 0) {
                stats[fieldName] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            }
        });

        return stats;
    }, [draggedData, fields, isCSVMode, computedColumns]);

    // Sync draggedData back to parent when sortOrder or sortDirection changes (after sorting is complete)
    // This ensures picklistOrder edits persist across re-sorts
    useEffect(() => {
        if (draggedData.length > 0 && onDataChange) {
            onDataChange(draggedData);
        }
    }, [sortOrder, sortDirection]);

    return (
        <div className={`overflow-x-scroll ${isCSVMode ? 'overflow-y-auto h-full' : 'md:overflow-x-clip min-h-1/2 md:min-h-3/5'} overscroll-none`}>
            <div className={`${isCSVMode ? 'min-h-full' : ''}`}>
            <div className={clsx(
                'flex flex-row items-center justify-start mx-auto h-14 rounded-t-lg border-b border-gray-500 md:border-none mr-2 md:mr-0',
                isCSVMode ? 'w-max bg-slate-900 sticky top-0 z-30' : 'gap-3 w-[240vw] md:w-auto bg-transparent md:bg-gray-700/50'
            )}>
                <div className={clsx('relative flex items-center justify-center', {
                    'sticky left-0 z-40 h-full': isCSVMode,
                    'w-4 h-4': !isCSVMode
                })}
                     style={isCSVMode ? { width: '60px', backgroundColor: '#0f172a' } : undefined}>
                    <input
                        type="checkbox"
                        className="appearance-none w-4 h-4 bg-gray-500 bg-opacity-50 border-2 border-gray-500 rounded-sm focus:ring-0 checked:bg-red-400/25 checked:border-red-400/50"
                        disabled
                    />
                </div>
                <div className={`flex flex-row items-center ${isCSVMode ? 'justify-start' : 'justify-between w-full ml-6 md:ml-16'} ${isCSVMode ? '' : ''}`}>
                    {fields.map((name, index) => {
                        const isRank = name.toLowerCase() === 'rank';
                        const hasRankColumn = fields.some(f => f.toLowerCase() === 'rank');
                        const isLastFrozenColumn = isRank || (name === 'Team' && !hasRankColumn);
                        return (
                        <div key={name}
                             className={clsx(
                                isCSVMode ? (name === 'Picklist Order' ? 'min-w-[136px] w-[136px] h-full flex items-center justify-center' : name === 'Team' ? 'min-w-[140px] w-[140px] h-full flex items-center justify-center' : isRank ? 'min-w-[140px] w-[140px] h-full flex items-center justify-center' : 'min-w-[160px] w-[160px] h-full flex items-center justify-center') : `${name.includes('[Branch]') ? 'w-[40vw]' : 'w-[35vw]'} md:w-1/6 ml-4 md:ml-0`,
                                {
                                    'sticky z-40': isCSVMode && (name === 'Picklist Order' || name === 'Team' || isRank),
                                    'left-[60px]': isCSVMode && name === 'Picklist Order',
                                    'left-[196px]': isCSVMode && name === 'Team',
                                    'left-[336px]': isCSVMode && isRank,
                                    'shadow-[2px_0_4px_rgba(0,0,0,0.3)]': isCSVMode && isLastFrozenColumn
                                }
                            )}
                             style={isCSVMode && name === 'Picklist Order' ? { backgroundColor: '#0f172a', pointerEvents: 'auto' } : isCSVMode && name === 'Team' ? { backgroundColor: '#0f172a', pointerEvents: 'auto' } : isCSVMode && isRank ? { backgroundColor: '#0f172a', pointerEvents: 'auto' } : { pointerEvents: 'auto' }}>
                            {
                                name.includes("[Branch]") ? (
                                    <div className="flex flex-row w-3/5 md:w-full items-center gap-2">
                                        <p className="font-bold text-[12px] whitespace-nowrap lg:text-[13px] xl:text-sm px-2 md:px-0"><span className="hidden md:inline-block">Total</span> Coral on</p>
                                        <select
                                            id="branchChooser"
                                            className="w-[68px] h-9 md:h-10 rounded-md bg-white/10 outline outline-white/25 border-r-8 border-transparent text-white text-[13px] xl:text-sm font-bold p-1 md:p-2.5"
                                            onChange={(event) => setBranch(event.target.value as Branches)}
                                            defaultValue="L4">
                                            <optgroup>
                                                <option className="bg-slate-800">L1</option>
                                                <option className="bg-slate-800">L2</option>
                                                <option className="bg-slate-800">L3</option>
                                                <option className="bg-slate-800">L4</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="group/header flex items-center justify-center gap-1 w-full h-full">
                                        <button
                                            onClick={() => onColumnSort && onColumnSort(name)}
                                            className="flex items-center justify-center gap-1 font-bold text-[12px] whitespace-nowrap lg:text-[13px] xl:text-sm hover:text-blue-400 transition-colors cursor-pointer"
                                            style={{ pointerEvents: 'auto' }}
                                            disabled={!onColumnSort}
                                        >
                                            <span>{name}</span>
                                            {sortOrder === name && (
                                                <span className="text-[10px]">
                                                    {sortDirection === 'asc' ? '▲' : '▼'}
                                                </span>
                                            )}
                                        </button>
                                        {computedColumns.some(col => col.name === name) && onDeleteComputedColumn && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Are you sure you want to delete the computed column "${name}"?`)) {
                                                        onDeleteComputedColumn(name);
                                                    }
                                                }}
                                                className="ml-1 p-1 hover:bg-red-500/20 rounded transition-all opacity-0 group-hover/header:opacity-100"
                                                title="Delete computed column"
                                                style={{ pointerEvents: 'auto' }}
                                            >
                                                <svg className="w-3 h-3 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                )
                            }
                        </div>
                        );
                    })}
                </div>
            </div>
            <DragDropContext onDragEnd={handleOnDragEnd} key={newKey}>
                <Droppable droppableId="tableRows">
                    {(provided) => (
                        <div
                            className={`${isCSVMode ? 'w-max' : 'w-[240vw] md:w-full'} ${isCSVMode ? '' : 'h-[46vh] md:h-[51vh] overflow-y-auto'}`}
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                        >
                            {draggedData.map((datum, index) => (
                                <Draggable
                                    key={datum.teamNumber.toString()}
                                    draggableId={datum.teamNumber.toString()}
                                    index={index}
                                >
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                        >
                                            <TableRow
                                                key={datum.teamNumber}
                                                data={datum}
                                                selectedBranch={branch}
                                                addTeam={addTeam}
                                                removeTeam={removeTeam}
                                                currentlyActive={activeTeams.includes(datum.teamNumber)}
                                                isDragging={snapshot.isDragging}
                                                fields={fields}
                                                isCSVMode={isCSVMode}
                                                updatePicklistOrder={updatePicklistOrder}
                                                columnStats={columnStats}
                                                computedColumns={computedColumns}
                                            />
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
            </div>
        </div>
    );
}