'use client';

import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import { rethinkSans } from "@/app/ui/fonts";
import { useState, useEffect } from "react";
import Table from "@/app/ui/event/table";
import { CSVRowData } from "@/app/lib/types";
import Summarizer from "@/app/ui/event/summarizer";
import SaveModal from "@/app/ui/event/save-modal";
import Alert from "@/app/ui/alert";
import SavedPicklistsSidebar from "@/app/ui/event/saved-picklists-sidebar";
import ComputedColumnModal, { ComputedColumn } from "@/app/ui/event/computed-column-modal";

const STORAGE_KEY = 'thunderpick_table_state';
const COMPUTED_COLUMNS_KEY = 'thunderpick_computed_columns';

export default function Page() {
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [csvData, setCSVData] = useState<CSVRowData[]>([]);
    const [csvFields, setCSVFields] = useState<string[]>([]);
    const [showTable, setShowTable] = useState(false);
    const [sortOrder, setSortOrder] = useState("Picklist Order");
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [isModalOpen, setModalStatus] = useState(false);
    const [[alertType, alertMessage], setAlertInfo] = useState(["", ""]);
    const [isStateLoaded, setIsStateLoaded] = useState(false);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
    const [computedColumns, setComputedColumns] = useState<ComputedColumn[]>([]);
    const [isComputedColumnModalOpen, setComputedColumnModalOpen] = useState(false);

    // Load state from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const state = JSON.parse(saved);
                    setCSVData(state.csvData || []);
                    setCSVFields(state.csvFields || []);
                    setSortOrder(state.sortOrder || "Picklist Order");
                    setSortDirection(state.sortDirection || 'asc');
                    setShowTable(state.showTable || false);
                }

                // Load computed columns
                const savedComputedColumns = localStorage.getItem(COMPUTED_COLUMNS_KEY);
                if (savedComputedColumns) {
                    setComputedColumns(JSON.parse(savedComputedColumns));
                }
            } catch (e) {
                console.error('Failed to load state from localStorage:', e);
            }
            setIsStateLoaded(true);
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined' && isStateLoaded && showTable) {
            try {
                const state = {
                    csvData,
                    csvFields,
                    sortOrder,
                    sortDirection,
                    showTable
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                console.error('Failed to save state to localStorage:', e);
            }
        }
    }, [csvData, csvFields, sortOrder, sortDirection, showTable, isStateLoaded]);

    // Save computed columns to localStorage whenever they change
    useEffect(() => {
        if (typeof window !== 'undefined' && isStateLoaded) {
            try {
                localStorage.setItem(COMPUTED_COLUMNS_KEY, JSON.stringify(computedColumns));
            } catch (e) {
                console.error('Failed to save computed columns to localStorage:', e);
            }
        }
    }, [computedColumns, isStateLoaded]);

    // Evaluate a formula for a given row
    const evaluateFormula = (formula: string, row: CSVRowData, fields: string[]): number | null => {
        try {
            // Replace column names with actual values
            let expression = formula;

            // Sort fields by length (longest first) to match longer names before shorter ones
            const sortedFields = [...fields].sort((a, b) => b.length - a.length);

            for (const field of sortedFields) {
                if (['Picklist Order', 'Team', 'Rank'].includes(field)) continue;

                // Get the value from the row
                const dataKey = field.toLowerCase().replace(/\s+/g, '');
                let value = row[dataKey as keyof typeof row];

                // Try exact match if dataKey doesn't work
                if (value === undefined) {
                    const matchingKey = Object.keys(row).find(
                        key => key.toLowerCase() === field.toLowerCase().replace(/\s+/g, '')
                    );
                    if (matchingKey) {
                        value = row[matchingKey as keyof typeof row];
                    }
                }

                // Replace column name with value if it's numeric
                if (typeof value === 'number') {
                    // Use word boundaries to avoid partial matches and handle case insensitively
                    const regex = new RegExp('\\b' + field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
                    expression = expression.replace(regex, `(${value})`);
                } else if (value === undefined || value === null) {
                    // If value is missing, replace with 0
                    const regex = new RegExp('\\b' + field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
                    expression = expression.replace(regex, '0');
                }
            }

            // Evaluate the expression safely
            const result = Function('"use strict"; return (' + expression + ')')();

            if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                return result;
            }

            return null;
        } catch (e) {
            console.error('Failed to evaluate formula:', formula, e);
            return null;
        }
    };

    // Apply computed columns to data
    const applyComputedColumns = (data: CSVRowData[], columns: ComputedColumn[], fields: string[]): CSVRowData[] => {
        return data.map(row => {
            const updatedRow = { ...row };

            for (const column of columns) {
                const value = evaluateFormula(column.formula, row, fields);
                if (value !== null) {
                    // Store with normalized key
                    const key = column.name.toLowerCase().replace(/\s+/g, '');
                    updatedRow[key] = value;
                }
            }

            return updatedRow;
        });
    };

    // Add computed column names to fields array
    const getFieldsWithComputedColumns = (baseFields: string[], columns: ComputedColumn[]): string[] => {
        // Add computed columns after the base fields
        return [...baseFields, ...columns.map(c => c.name)];
    };

    // Handle adding a new computed column
    const handleAddComputedColumn = (column: ComputedColumn) => {
        const newComputedColumns = [...computedColumns, column];
        setComputedColumns(newComputedColumns);

        // Apply the new computed column to existing data
        const updatedData = applyComputedColumns(csvData, newComputedColumns, csvFields);
        setCSVData(updatedData);

        // Update fields to include the new column
        setCSVFields(getFieldsWithComputedColumns(csvFields, newComputedColumns));

        setAlertInfo(["Success", `Computed column "${column.name}" added successfully!`]);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setError(null);

        try {
            const text = await file.text();
            const { data, fields } = parseCSV(text);

            if (data.length === 0) {
                setError("No valid data found in CSV file");
                setIsProcessing(false);
                return;
            }

            // Apply computed columns to the loaded data
            const dataWithComputedColumns = applyComputedColumns(data, computedColumns, fields);
            const fieldsWithComputedColumns = getFieldsWithComputedColumns(fields, computedColumns);

            setCSVData(dataWithComputedColumns);
            setCSVFields(fieldsWithComputedColumns);
            setShowTable(true);
            setIsProcessing(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to parse CSV file");
            setIsProcessing(false);
        }
    };

    const parseUpdateCSV = (csvText: string): Map<number, Record<string, any>> => {
        const lines = csvText.trim().split('\n');

        if (lines.length < 2) {
            throw new Error("CSV must have at least a header row and one data row");
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim());

        // Find the team number column index
        const teamNumberIndex = headers.findIndex(h =>
            h.toLowerCase() === 'team number' || h.toLowerCase() === 'team'
        );

        if (teamNumberIndex === -1) {
            throw new Error("CSV must have a 'Team Number' or 'Team' column");
        }

        // Create a map of team number to metric data (NO picklistOrder generation)
        const dataMap = new Map<number, Record<string, any>>();

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cells = line.split(',').map(c => c.trim());
            if (cells.length !== headers.length) continue;

            // Get team number
            const teamNumber = parseInt(cells[teamNumberIndex]);
            if (Number.isNaN(teamNumber) || teamNumber <= 0) {
                continue;
            }

            // Create data object with only metrics (NO picklistOrder)
            const rowData: Record<string, any> = {};

            headers.forEach((header, index) => {
                if (index === teamNumberIndex) return; // Skip team number itself

                // Normalize header to check for variations
                const normalizedHeader = header.toLowerCase().replace(/[\s_-]/g, '');

                // IGNORE any variation of Team or Picklist Order
                if (normalizedHeader === 'team') return;
                if (normalizedHeader === 'picklistorder') return;

                const value = cells[index];
                const numValue = parseFloat(value);

                // Store as number if valid, otherwise as string
                const key = header.toLowerCase().replace(/\s+/g, '');
                rowData[key] = !Number.isNaN(numValue) ? numValue : value;
            });

            dataMap.set(teamNumber, rowData);
        }

        return dataMap;
    };

    const handleUpdateCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setError(null);

        try {
            const text = await file.text();
            const newDataMap = parseUpdateCSV(text);

            if (newDataMap.size === 0) {
                setError("No valid data found in CSV file");
                setIsProcessing(false);
                return;
            }

            // Update existing data: preserve ALL structure, only update numeric metrics
            const updatedData = csvData.map(existingRow => {
                const newMetrics = newDataMap.get(existingRow.teamNumber);

                if (!newMetrics) {
                    // Team not in new CSV, keep existing row COMPLETELY unchanged
                    return existingRow;
                }

                // Start with ALL existing fields (preserves everything)
                const updated: CSVRowData = { ...existingRow };

                // CRITICAL: Explicitly lock these fields - they must NEVER change
                updated.teamNumber = existingRow.teamNumber;
                updated.picklistOrder = existingRow.picklistOrder;

                // Only overwrite metric fields from new CSV data
                Object.keys(newMetrics).forEach(key => {
                    // Skip any key that could be team or picklistOrder (multiple case variations)
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('team') || lowerKey.includes('picklist')) {
                        return; // Skip completely
                    }
                    // Overwrite metric value from new CSV
                    updated[key] = newMetrics[key];
                });

                return updated;
            });

            // Recompute computed columns after updating metrics
            const baseFields = csvFields.filter(f => !computedColumns.some(cc => cc.name === f));
            const dataWithRecomputedColumns = applyComputedColumns(updatedData, computedColumns, baseFields);

            setCSVData(dataWithRecomputedColumns);
            setAlertInfo(["Success", "CSV data updated successfully"]);
            setIsProcessing(false);

            // Reset the file input
            event.target.value = '';
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update CSV file");
            setIsProcessing(false);
        }
    };

    const parseCSV = (csvText: string): { data: CSVRowData[], fields: string[] } => {
        const lines = csvText.trim().split('\n');

        if (lines.length < 2) {
            throw new Error("CSV must have at least a header row and one data row");
        }

        // Parse headers
        let headers = lines[0].split(',').map(h => h.trim());

        // Find the team number column index
        const teamNumberIndex = headers.findIndex(h =>
            h.toLowerCase() === 'team number' || h.toLowerCase() === 'team'
        );

        if (teamNumberIndex === -1) {
            throw new Error("CSV must have a 'Team Number' or 'Team' column");
        }

        // Remove duplicate "Team" column if both "Team Number" and "Team" exist
        const hasTeamNumber = headers.some(h => h.toLowerCase() === 'team number');
        const hasTeam = headers.some(h => h.toLowerCase() === 'team');

        if (hasTeamNumber && hasTeam) {
            // Keep Team Number, remove Team
            headers = headers.filter(h => h.toLowerCase() !== 'team' || h.toLowerCase() === 'team number');
        }

        // Map "Team Number" to "Team" for display
        const displayHeaders = headers.map(h => h === 'Team Number' ? 'Team' : h);

        // Add "Picklist Order" as the first field, then Team, then other fields
        // Filter out Team Number from other positions
        const otherFields = displayHeaders.filter(h => h.toLowerCase() !== 'team' && h.toLowerCase() !== 'team number');
        const fieldsWithPicklistOrder = ['Picklist Order', 'Team', ...otherFields];

        // Parse data rows
        const data: CSVRowData[] = [];
        const seenTeams = new Set<number>();
        let picklistOrder = 1;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cells = line.split(',').map(c => c.trim());

            if (cells.length !== headers.length) continue;

            // Get team number
            const teamNumber = parseInt(cells[teamNumberIndex]);
            if (Number.isNaN(teamNumber) || teamNumber <= 0 || seenTeams.has(teamNumber)) {
                continue;
            }

            seenTeams.add(teamNumber);

            // Create row object with dynamic properties
            const row: CSVRowData = { teamNumber, picklistOrder: picklistOrder++ };

            headers.forEach((header, index) => {
                if (index === teamNumberIndex) return; // Skip team number, already added
                if (header.toLowerCase() === 'team') return; // Skip duplicate team column

                const value = cells[index];
                const numValue = parseFloat(value);

                // Store as number if valid, otherwise as string
                const key = header.toLowerCase().replace(/\s+/g, '');
                row[key] = !Number.isNaN(numValue) ? numValue : value;
            });

            data.push(row);
        }

        return { data, fields: fieldsWithPicklistOrder };
    };

    const [bestPick, setBestPick] = useState<CSVRowData>({ teamNumber: 0, picklistOrder: 0 });
    const [bestCoralBot, setBestCoralBot] = useState(0);
    const [bestAlgaeBot, setBestAlgaeBot] = useState(0);

    // Handle data changes from table (including picklistOrder updates)
    const handleDataChange = (updatedData: CSVRowData[]) => {
        setCSVData(updatedData);
    };

    // Handle column header click for sorting
    const handleColumnSort = (columnName: string) => {
        if (sortOrder === columnName) {
            // Toggle direction if clicking same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New column - default to desc (except Picklist Order which defaults to asc)
            setSortOrder(columnName);
            setSortDirection(columnName === 'Picklist Order' ? 'asc' : 'desc');
        }
    };

    // Load a saved picklist from sidebar
    const handleLoadPicklist = (picklist: any) => {
        setCSVData(picklist.data);
        setCSVFields(picklist.fields);
        setSortOrder(picklist.sortOrder);
        setSortDirection(picklist.sortDirection);

        // Restore computed columns if they exist
        if (picklist.computedColumns) {
            setComputedColumns(picklist.computedColumns);
        }

        setShowTable(true);
        setAlertInfo(["Success", `Loaded picklist "${picklist.name}"`]);
    };

    // Refresh sidebar after save
    const handleSaveComplete = () => {
        setSidebarRefreshKey(prev => prev + 1);
    };

    if (showTable) {
        return (
            <div className="relative flex flex-col items-center justify-start md:justify-center w-screen max-h-screen h-auto md:h-screen overflow-y-hidden">
                <SavedPicklistsSidebar
                    key={sidebarRefreshKey}
                    onLoad={handleLoadPicklist}
                />
                {alertMessage && <Alert color={alertType as "Error" | "Success"} message={alertMessage} />}
                <div className="flex flex-col items-center justify-center gap-3 md:gap-4 md:flex-none md:grid md:grid-cols-5 w-4/5 md:w-11/12 h-2/5 md:h-[14%] -mt-1">
                    <div className="flex flex-col items-start justify-center">
                        <h1 className={`${rethinkSans.className} text-[56px] md:text-7xl font-extrabold`} style={{ color: '#006400' }}>ThunderPick</h1>
                        <button
                            className="text-sm underline font-medium mt-2 md:mt-3 bg-transparent"
                            style={{ color: '#228B22' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#2E8B57'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#228B22'}
                            onClick={() => setModalStatus(true)}>
                            Save Picklist
                        </button>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2">
                        <label htmlFor="csv-update" className="cursor-pointer">
                            <div className="flex items-center gap-2 px-4 py-2 text-white font-semibold rounded-lg transition-colors" style={{ backgroundColor: '#006400' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#228B22'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#006400'}>
                                <DocumentArrowUpIcon className="w-5 h-5" />
                                <span>Update CSV</span>
                            </div>
                        </label>
                        <input
                            id="csv-update"
                            type="file"
                            accept=".csv"
                            onChange={handleUpdateCSV}
                            disabled={isProcessing}
                            className="hidden"
                        />
                        <button
                            className="text-xs underline font-medium bg-transparent"
                            style={{ color: '#228B22' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#2E8B57'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#228B22'}
                            onClick={() => setComputedColumnModalOpen(true)}>
                            Add Computed Column
                        </button>
                    </div>
                    <Summarizer
                        bestPick={bestPick as any}
                        bestCoralBot={bestCoralBot}
                        bestAlgaeBot={bestAlgaeBot}
                    />
                </div>
                <div className="w-[95vw] md:w-11/12 h-[42%] md:h-[72%] mt-5 md:mt-6 ml-[5vw] md:ml-0">
                    <Table
                        data={csvData}
                        fields={csvFields}
                        sortOrder={sortOrder}
                        sortDirection={sortDirection}
                        isStatic={false}
                        timesSaved={0}
                        setAlertInfo={setAlertInfo}
                        setBestPick={setBestPick as any}
                        setBestCoralBot={setBestCoralBot}
                        setBestAlgaeBot={setBestAlgaeBot}
                        isCSVMode={true}
                        onDataChange={handleDataChange}
                        onColumnSort={handleColumnSort}
                    />
                </div>
                <div className={isModalOpen ? '' : 'hidden'}>
                    <SaveModal
                        data={csvData as any}
                        fields={csvFields}
                        sortOrder={sortOrder}
                        sortDirection={sortDirection}
                        computedColumns={computedColumns}
                        setModalStatus={setModalStatus}
                        setAlertInfo={setAlertInfo}
                        onSaveComplete={handleSaveComplete}
                    />
                </div>
                <div className={isComputedColumnModalOpen ? '' : 'hidden'}>
                    <ComputedColumnModal
                        existingFields={csvFields}
                        setModalStatus={setComputedColumnModalOpen}
                        onAdd={handleAddComputedColumn}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center w-screen h-screen">
            <SavedPicklistsSidebar
                key={sidebarRefreshKey}
                onLoad={handleLoadPicklist}
            />
            <div className="flex flex-col w-5/6 md:w-3/4 h-screen md:h-[87.5vh] gap-4">
                <div className="inline-block flex-col items-start justify-center border-b border-[#929292]/50 w-auto basis-1/5">
                    <h1 className={`${rethinkSans.className} antialiased text-[12.3vw] md:text-6xl font-extrabold`} style={{ color: '#006400' }}>ThunderPick</h1>
                </div>
                <div className="flex flex-col items-start justify-center w-full basis-4/5 gap-4">
                    <div className="inline-block w-full">
                        <p className="text-lg">Upload CSV</p>
                        <p className="text-xs text-gray-400 mt-1">Select a CSV file containing team data</p>
                    </div>
                    <div className="flex items-center justify-center w-full h-[60vh] md:h-[65vh] rounded-xl bg-slate-800 border-2 border-blue-500/30">
                        <label htmlFor="csv-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate-700/50 transition-colors rounded-xl">
                            <DocumentArrowUpIcon className="w-16 h-16 md:w-20 md:h-20 text-blue-500 mb-4" />
                            <p className="text-base md:text-lg text-white font-semibold">
                                {isProcessing ? "Processing..." : "Click to upload CSV"}
                            </p>
                            <p className="text-xs md:text-sm text-gray-400 mt-2">
                                CSV file with team data (must include Team Number column)
                            </p>
                            <input
                                id="csv-upload"
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={isProcessing}
                                className="hidden"
                            />
                        </label>
                    </div>
                    {error && (
                        <div className="w-full">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}