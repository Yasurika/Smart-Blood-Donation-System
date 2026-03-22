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

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function EditStockPage() {
    const router = useRouter();
    const [stocks, setStocks] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editValues, setEditValues] = useState<Record<string, number>>({});
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
                
                const stockItems = BLOOD_TYPES.map(type => ({
                    _id: type,
                    bloodType: type,
                    units: summary[type]?.totalUnits || 0,
                    capacity: CAPACITY_MAP[type],
                    lastUpdated: new Date().toISOString(),
                }));
                
                setStocks(stockItems);
                
                // Initialize edit values
                const initial: Record<string, number> = {};
                BLOOD_TYPES.forEach(type => {
                    initial[type] = summary[type]?.totalUnits || 0;
                });
                setEditValues(initial);
            }
        } catch (err) {
            console.error('Failed to fetch stocks:', err);
            setMessage({ type: 'error', text: 'Failed to load stock data' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (bloodType: string, value: string) => {
        setEditValues(prev => ({
            ...prev,
            [bloodType]: Math.max(0, parseInt(value) || 0)
        }));
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const failedUpdates: string[] = [];
            
            // Update each blood type
            for (const type of BLOOD_TYPES) {
                const units = editValues[type] || 0;
                const res = await fetch('/api/stock', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bloodType: type, units }),
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    failedUpdates.push(`${type}: ${errorData.message || 'Unknown error'}`);
                }
            }

            if (failedUpdates.length > 0) {
                setMessage({ 
                    type: 'error', 
                    text: `Failed to update: ${failedUpdates.join(', ')}` 
                });
            } else {
                setMessage({ type: 'success', text: 'All stocks updated successfully!' });
                setTimeout(() => router.push('/dashboard/stock'), 2000);
            }
        } catch (err) {
            console.error('Failed to save stocks:', err);
            setMessage({ type: 'error', text: 'Error updating stocks: ' + (err as Error).message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
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
                            className="text-sm text-blue-500 hover:text-blue-600 font-semibold mb-4 flex items-center gap-1"
                        >
                            ← Back to Stock
                        </button>
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
                            Edit Blood <span className="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">Stock</span>
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-gray-400">Adjust stock levels for all blood types</p>
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

                <GlassCard className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {BLOOD_TYPES.map((type, i) => {
                            const capacity = CAPACITY_MAP[type];
                            const percentage = capacity > 0 ? Math.round((editValues[type] / capacity) * 100) : 0;

                            return (
                                <ScrollReveal key={type} delay={i * 0.05} direction="up">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-baseline">
                                            <label className="text-sm font-semibold text-slate-900 dark:text-white">
                                                Blood Type {type}
                                            </label>
                                            <span className={`text-xs font-bold ${percentage > 80 ? 'text-green-500' : percentage > 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                {percentage}%
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            max={capacity}
                                            value={editValues[type] || 0}
                                            onChange={(e) => handleChange(type, e.target.value)}
                                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400">
                                            <span>Units: {editValues[type]}/{capacity}</span>
                                            <span>{capacity} unit capacity</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percentage}%` }}
                                                transition={{ duration: 0.5 }}
                                            />
                                        </div>
                                    </div>
                                </ScrollReveal>
                            );
                        })}
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={handleSaveAll}
                            disabled={saving}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                            {saving ? 'Saving...' : '💾 Save All Changes'}
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/stock')}
                            disabled={saving}
                            className="flex-1 px-6 py-3 bg-slate-500 hover:bg-slate-600 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                            Cancel
                        </button>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
