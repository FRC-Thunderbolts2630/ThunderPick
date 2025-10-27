'use client';

import { useState, FormEvent } from 'react';
import { rethinkSans } from "@/app/ui/fonts";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { PlusIcon } from "@heroicons/react/24/solid";

export interface ComputedColumn {
    name: string;
    formula: string;
    type: 'numeric' | 'boolean';
}

export default function ComputedColumnModal({
    existingFields,
    setModalStatus,
    onAdd
}: {
    existingFields: string[];
    setModalStatus: (state: boolean) => void;
    onAdd: (column: ComputedColumn) => void;
}) {
    const [columnName, setColumnName] = useState("");
    const [formula, setFormula] = useState("");
    const [columnType, setColumnType] = useState<'numeric' | 'boolean'>('numeric');
    const [error, setError] = useState("");

    const resetForm = () => {
        setColumnName("");
        setFormula("");
        setColumnType('numeric');
        setError("");
    };

    const handleClose = () => {
        resetForm();
        setModalStatus(false);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setError("");

        // Validate column name
        if (!columnName.trim()) {
            setError("Please enter a column name.");
            return;
        }

        // Note: We allow overwriting existing columns, so no check for duplicates

        // Validate formula
        if (!formula.trim()) {
            setError("Please enter a formula.");
            return;
        }

        // Validate that referenced columns exist
        const validationError = validateFormula(formula, existingFields);
        if (validationError) {
            setError(validationError);
            return;
        }

        // Add the computed column
        onAdd({
            name: columnName.trim(),
            formula: formula.trim(),
            type: columnType
        });

        // Reset form and close
        resetForm();
        setModalStatus(false);
    };

    const validateFormula = (formula: string, availableFields: string[]): string | null => {
        // Simple approach: try to evaluate a test expression
        // Replace each column name with a test number
        let testExpression = formula;

        // Sort fields by length (longest first) to avoid partial matches
        const sortedFields = [...availableFields]
            .filter(f => !['Picklist Order', 'Team', 'Rank'].includes(f))
            .sort((a, b) => b.length - a.length);

        let foundColumns = 0;

        // Replace each column name with a test value
        for (const field of sortedFields) {
            // Create a regex that matches the field name (case insensitive)
            const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp('\\b' + escapedField + '\\b', 'gi');

            const matches = testExpression.match(regex);
            if (matches) {
                foundColumns += matches.length;
                testExpression = testExpression.replace(regex, '1');
            }
        }

        // Ensure at least one column is referenced
        if (foundColumns === 0) {
            return `Formula must reference at least one column. Available columns: ${sortedFields.join(', ')}`;
        }

        // Try to evaluate the test expression
        try {
            const result = Function('"use strict"; return (' + testExpression + ')')();

            // For numeric type, require numeric result
            if (columnType === 'numeric') {
                if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
                    return `Invalid formula. Check operators and parentheses.`;
                }
            }
            // For boolean type, require boolean result
            else if (columnType === 'boolean') {
                if (typeof result !== 'boolean') {
                    return `Invalid condition. Must evaluate to true/false. Use comparison operators: >, <, >=, <=, ==, !=`;
                }
            }
        } catch (e) {
            const operators = columnType === 'numeric' ? '+, -, *, /' : '>, <, >=, <=, ==, !=, &&, ||';
            return `Invalid ${columnType === 'numeric' ? 'formula' : 'condition'} syntax. Check column names, operators (${operators}), and parentheses. Available columns: ${sortedFields.join(', ')}`;
        }

        return null;
    };

    // Get numeric fields only (exclude Picklist Order, Team, Rank)
    const numericFields = existingFields.filter(f =>
        !['Picklist Order', 'Team', 'Rank'].includes(f)
    );

    return (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[6px] z-50">
            <div className="relative flex flex-col items-center justify-center w-5/6 md:w-2/5 h-auto py-8 bg-slate-800/80 md:bg-slate-800/75 backdrop-blur-[60px] md:backdrop-blur-2xl rounded-xl border-2 border-green-600/50 gap-4">
                <div className="w-5/6">
                    <h1 className={`${rethinkSans.className} antialiased font-extrabold text-2xl md:text-3xl`} style={{ color: '#228B22', textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}>
                        Add Computed Column
                    </h1>
                    <p className="text-xs text-gray-400 mt-2">
                        Create a new column by combining existing numeric columns with a formula.
                    </p>
                </div>

                <form className="w-5/6 space-y-4" onSubmit={handleSubmit}>
                    {/* Column Name Input */}
                    <div>
                        <label htmlFor="columnName" className="text-xs md:text-sm font-medium">Column Name</label>
                        <input
                            id="columnName"
                            name="columnName"
                            type="text"
                            className="w-full h-12 rounded-md bg-slate-800 mt-1 border border-slate-600 px-4 focus:outline-none focus:border-green-500 text-[16px] md:text-base"
                            placeholder="e.g., Combined Score"
                            value={columnName}
                            onChange={(e) => setColumnName(e.target.value)}
                        />
                    </div>

                    {/* Column Type Selector */}
                    <div>
                        <label className="text-xs md:text-sm font-medium">Column Type</label>
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="columnType"
                                    value="numeric"
                                    checked={columnType === 'numeric'}
                                    onChange={(e) => setColumnType('numeric')}
                                    className="w-4 h-4 text-green-600 focus:ring-green-500 focus:ring-2"
                                />
                                <span className="text-sm">Numeric Formula</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="columnType"
                                    value="boolean"
                                    checked={columnType === 'boolean'}
                                    onChange={(e) => setColumnType('boolean')}
                                    className="w-4 h-4 text-green-600 focus:ring-green-500 focus:ring-2"
                                />
                                <span className="text-sm">Boolean Condition</span>
                            </label>
                        </div>
                    </div>

                    {/* Formula Input */}
                    <div>
                        <label htmlFor="formula" className="text-xs md:text-sm font-medium">
                            {columnType === 'numeric' ? 'Formula' : 'Condition'}
                        </label>
                        <input
                            id="formula"
                            name="formula"
                            type="text"
                            className="w-full h-12 rounded-md bg-slate-800 mt-1 border border-slate-600 px-4 focus:outline-none focus:border-green-500 text-[16px] md:text-base font-mono"
                            placeholder={
                                columnType === 'numeric'
                                    ? "e.g., 0.4 * Auto EPA + 0.6 * Teleop EPA"
                                    : "e.g., Deep Cage Climb > 0.5"
                            }
                            value={formula}
                            onChange={(e) => setFormula(e.target.value)}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            {columnType === 'numeric'
                                ? 'Use column names and operators: + - * / ( )'
                                : 'Use column names and operators: > < >= <= == != && ||'}
                        </p>
                    </div>

                    {/* Available Columns */}
                    <div className="bg-slate-700/30 rounded-md p-3 max-h-32 overflow-y-auto">
                        <p className="text-xs font-medium text-gray-300 mb-1">Available Columns:</p>
                        <div className="flex flex-wrap gap-1">
                            {numericFields.map(field => (
                                <span
                                    key={field}
                                    className="text-xs bg-slate-600/50 px-2 py-1 rounded cursor-pointer hover:bg-slate-600"
                                    onClick={() => setFormula(prev => prev + (prev ? ' ' : '') + field)}
                                >
                                    {field}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex flex-row items-center justify-center gap-2 flex-1 h-12 rounded-md font-extrabold text-base transition-colors"
                            style={{ backgroundColor: '#006400', color: '#FFFFFF' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#228B22'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#006400'}
                        >
                            <PlusIcon className="w-5 h-5" />
                            <p>Add Column</p>
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 h-12 rounded-md font-medium text-base bg-slate-600/50 hover:bg-slate-600 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>

                <button className="absolute w-8 h-8 right-4 top-4" onClick={handleClose}>
                    <XMarkIcon className="w-7 h-7 md:w-8 md:h-8 text-slate-400 hover:text-slate-200" />
                </button>
            </div>
        </div>
    );
}
