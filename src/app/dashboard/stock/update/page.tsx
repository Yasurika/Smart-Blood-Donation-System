'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import ScrollReveal from '@/components/animations/ScrollReveal';

interface StockItem {
    _id: string;
    bloodType: string;
    units: number;
    capacity: number;
    lastUpdated: string;
}

const CAPACITY_MAP: Record<string, number> = {
    'A+': 400, 'A-': 150, 'B+': 300, 'B-': 100,
    'AB+': 120, 'AB-': 80, 'O+': 500, 'O-': 200,
};

const COLOR_MAP: Record<string, string> = {
    'A+': 'from-red-500 to-red-600', 'A-': 'from-red-400 to-red-500',
    'B+': 'from-blue-500 to-blue-600', 'B-': 'from-blue-400 to-blue-500',
    'AB+': 'from-purple-500 to-purple-600', 'AB-': 'from-purple-400 to-purple-500',
    'O+': 'from-green-500 to-green-600', 'O-': 'from-orange-500 to-orange-600',
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function UpdateStockPage() {
    const router = useRouter();
    const [stocks, setStocks] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState<string>('A+');
    const [updateAmount, setUpdateAmount] = useState<string>('');
    const [updateType, setUpdateType] = useState<'set' | 'add' | 'subtract'>('set');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchStocks();
    }, []);

    const fetchStocks = async () => {
        try {
            const res = await fetch('/api/stock?summary=true');
            if (res.ok) {
                const data = await res.json();
                const summary = data.data?.summary || {};
                const items = BLOOD_TYPES.map(type => ({
                    _id: type,
                    bloodType: type,
                    units: summary[type]?.totalUnits || 0,
                    capacity: CAPACITY_MAP[type],
                    lastUpdated: new Date().toISOString(),
                }));
                setStocks(items);
            }
        } catch (err) {
            console.error('Failed to fetch stocks:', err);
            setMessage({ type: 'error', text: 'Failed to load stock data' });
        } finally {
            setLoading(false);
        }
    };

    const currentStock = stocks.find(s => s.bloodType === selectedType);
    const amount = parseInt(updateAmount) || 0;
    let newStock = currentStock?.units || 0;

    if (updateType === 'add') {
        newStock = (currentStock?.units || 0) + amount;
    } else if (updateType === 'subtract') {
        newStock = Math.max(0, (currentStock?.units || 0) - amount);
    } else {
        newStock = amount;
    }

    const newPercentage = currentStock ? Math.round((newStock / currentStock.capacity) * 100) : 0;

    const handleUpdate = async () => {
        if (!currentStock) return;

        setSaving(true);
        try {
            const res = await fetch('/api/stock', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bloodType: selectedType, units: newStock }),
            });

            if (res.ok) {
                // Refresh stocks and wait for it to complete
                await fetchStocks();
                setMessage({ type: 'success', text: `${selectedType} stock updated successfully!` });
                setUpdateAmount('');
            } else {
                const errorData = await res.json();
                setMessage({ type: 'error', text: errorData.message || 'Failed to update stock' });
            }
        } catch (err) {
            console.error('Failed to update stock:', err);
            setMessage({ type: 'error', text: 'Error updating stock: ' + (err as Error).message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-4xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="mb-10">
                        <button
                            onClick={() => router.back()}
                            className="text-sm text-green-500 hover:text-green-600 font-semibold mb-4 flex items-center gap-1"
                        >
                            ← Back to Stock
                        </button>
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
                            Update Blood <span className="bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent">Stock</span>
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-gray-400">Quickly update stock levels for individual blood types</p>
                    </div>
                </ScrollReveal>

                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mb-6 p-4 rounded-lg font-semibold ${
                            message.type === 'success'
                                ? 'bg-green-500/20 border border-green-500/40 text-green-700 dark:text-green-400'
                                : 'bg-red-500/20 border border-red-500/40 text-red-700 dark:text-red-400'
                        }`}
                    >
                        {message.text}
                    </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Blood Type Selector */}
                    <GlassCard className="p-8">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Select Blood Type</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {BLOOD_TYPES.map(type => {
                                const stock = stocks.find(s => s.bloodType === type);
                                const isSelected = selectedType === type;

                                return (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedType(type)}
                                        className={`p-4 rounded-lg font-bold text-lg transition-all duration-300 ${
                                            isSelected
                                                ? `bg-gradient-to-r ${COLOR_MAP[type]} text-white shadow-lg scale-105`
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {type}
                                        <div className="text-xs mt-1 opacity-75">
                                            {stock?.units || 0}/{stock?.capacity || 0}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </GlassCard>

                    {/* Update Form */}
                    <ScrollReveal direction="right">
                        <GlassCard className="p-8">
                            {currentStock && (
                                <>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
                                        Update {selectedType}
                                    </h2>

                                    {/* Current Status */}
                                    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">Current Stock</p>
                                        <div className="flex justify-between items-baseline mb-2">
                                            <span className="text-3xl font-bold text-slate-900 dark:text-white">
                                                {currentStock.units}
                                            </span>
                                            <span className="text-sm text-slate-500 dark:text-gray-400">
                                                / {currentStock.capacity} units
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <motion.div
                                                className={`h-full bg-gradient-to-r ${COLOR_MAP[selectedType]}`}
                                                initial={{ width: 0 }}
                                                animate={{
                                                    width: `${Math.round((currentStock.units / currentStock.capacity) * 100)}%`
                                                }}
                                                transition={{ duration: 0.5 }}
                                            />
                                        </div>
                                    </div>

                                    {/* Update Type Selection */}
                                    <div className="mb-6 space-y-2">
                                        <label className="text-sm font-semibold text-slate-900 dark:text-white">Update Type</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['set', 'add', 'subtract'] as const).map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setUpdateType(type)}
                                                    className={`p-2 rounded font-semibold text-sm transition-all ${
                                                        updateType === type
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
                                                    }`}
                                                >
                                                    {type === 'set' ? '🎯 Set' : type === 'add' ? '➕ Add' : '➖ Remove'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="mb-6">
                                        <label className="text-sm font-semibold text-slate-900 dark:text-white block mb-2">
                                            {updateType === 'set' ? 'Set to' : updateType === 'add' ? 'Add amount' : 'Remove amount'}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={updateType === 'set' ? currentStock.capacity : 999}
                                            value={updateAmount}
                                            onChange={(e) => setUpdateAmount(e.target.value)}
                                            placeholder="Enter amount"
                                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>

                                    {/* Preview */}
                                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Preview</p>
                                        <div className="flex justify-between items-baseline mb-2">
                                            <span className="text-3xl font-bold text-blue-600 dark:text-blue-300">
                                                {newStock}
                                            </span>
                                            <span className="text-sm text-blue-600 dark:text-blue-400">
                                                / {currentStock.capacity} units ({newPercentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                                            <motion.div
                                                className={`h-full bg-gradient-to-r ${COLOR_MAP[selectedType]}`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${newPercentage}%` }}
                                                transition={{ duration: 0.5 }}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleUpdate}
                                            disabled={saving || !updateAmount}
                                            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                                        >
                                            {saving ? 'Updating...' : '✅ Update Stock'}
                                        </button>
                                        <button
                                            onClick={() => router.push('/dashboard/stock')}
                                            disabled={saving}
                                            className="flex-1 px-6 py-3 bg-slate-500 hover:bg-slate-600 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            )}
                        </GlassCard>
                    </ScrollReveal>
                </div>
            </div>
        </div>
    );
}
