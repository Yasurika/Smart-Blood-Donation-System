'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import GlassCard from '@/components/ui/GlassCard';
import ScrollReveal from '@/components/animations/ScrollReveal';
import AnimatedCounter from '@/components/animations/AnimatedCounter';

interface StockItem {
    type: string;
    units: number;
    capacity: number;
    expiringSoon: number;
}

interface StockAlert {
    message: string;
    type: 'critical' | 'warning' | 'info';
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

export default function StockPage() {
    const router = useRouter();
    const [stockData, setStockData] = useState<StockItem[]>([]);
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalUnits, setTotalUnits] = useState(0);
    const [totalExpiring, setTotalExpiring] = useState(0);
    const [editingBloodType, setEditingBloodType] = useState<string | null>(null);
    const [updateValues, setUpdateValues] = useState<Record<string, number>>({});

    useEffect(() => {
        async function fetchStock() {
            try {
                const res = await fetch('/api/stock?summary=true');
                if (res.ok) {
                    const json = await res.json();
                    const summary = json.data?.summary || {};
                    const allTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

                    let total = 0;
                    let expiring = 0;
                    const newAlerts: StockAlert[] = [];

                    const items = allTypes.map(type => {
                        const info = summary[type] || {};
                        const units = info.totalUnits || 0;
                        const capacity = CAPACITY_MAP[type];
                        const exp = info.nearestExpiry ? 1 : 0;
                        total += units;
                        expiring += exp;

                        const pct = Math.round((units / capacity) * 100);
                        if (pct < 20) {
                            newAlerts.push({
                                message: `${type} stock critically low at ${units}/${capacity} units. Launch emergency campaign.`,
                                type: 'critical',
                            });
                        } else if (pct < 40) {
                            newAlerts.push({
                                message: `${type} below optimal threshold. Consider targeted outreach.`,
                                type: 'warning',
                            });
                        }

                        return { type, units, capacity, expiringSoon: exp };
                    });

                    if (newAlerts.length === 0) {
                        newAlerts.push({ message: 'All blood types at healthy stock levels.', type: 'info' });
                    }

                    setStockData(items);
                    setAlerts(newAlerts);
                    setTotalUnits(total);
                    setTotalExpiring(expiring);
                } else {
                    // Fallback: show empty state
                    setStockData([]);
                }
            } catch (err) {
                console.error('Failed to fetch stock:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchStock();
    }, []);

    const handleEditClick = (bloodType: string) => {
        setEditingBloodType(bloodType);
        const current = stockData.find(s => s.type === bloodType);
        if (current) {
            setUpdateValues(prev => ({ ...prev, [bloodType]: current.units }));
        }
    };

    const handleUpdateStock = async (bloodType: string) => {
        try {
            const newUnits = updateValues[bloodType];
            const res = await fetch('/api/stock', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bloodType, units: newUnits }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error(`Failed to update ${bloodType}:`, errorData.message);
                setEditingBloodType(null);
                return;
            }

            // Refresh stock data after successful update
            const refreshRes = await fetch('/api/stock?summary=true');
            if (refreshRes.ok) {
                const json = await refreshRes.json();
                const summary = json.data?.summary || {};
                const allTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

                let total = 0;
                const items = allTypes.map(type => {
                    const info = summary[type] || {};
                    const units = info.totalUnits || 0;
                    const capacity = CAPACITY_MAP[type];
                    const exp = info.nearestExpiry ? 1 : 0;
                    total += units;
                    return { type, units, capacity, expiringSoon: exp };
                });

                setStockData(items);
                setTotalUnits(total);
            }
            setEditingBloodType(null);
        } catch (err) {
            console.error('Failed to update stock:', err);
        }
    };

    const handleCancelEdit = () => {
        setEditingBloodType(null);
        setUpdateValues({});
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    const availableUnits = stockData.reduce((sum, s) => sum + s.units, 0);

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-7xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="mb-10">
                        <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Real-time</span>
                        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Blood Stock <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Dashboard</span>
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-gray-400">Dynamic blood inventory with AI forecasting alerts.</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 mb-8">
                        <button
                            onClick={() => router.push('/dashboard/stock/edit')}
                            className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
                        >
                            <span>✏️</span> Edit Stock
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/stock/update')}
                            className="px-5 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
                        >
                            <span>📦</span> Update Stock
                        </button>
                    </div>
                </ScrollReveal>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Units', value: totalUnits, icon: '🩸' },
                        { label: 'Available', value: availableUnits, icon: '✅' },
                        { label: 'Blood Types', value: stockData.filter(s => s.units > 0).length, icon: '📋' },
                        { label: 'Alerts', value: alerts.filter(a => a.type !== 'info').length, icon: '⚠️' },
                    ].map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                            <GlassCard className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">{stat.label}</p>
                                        <AnimatedCounter target={stat.value} className="text-2xl font-bold text-slate-900 dark:text-white" />
                                    </div>
                                    <span className="text-2xl">{stat.icon}</span>
                                </div>
                            </GlassCard>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Blood Type Grid */}
                    <div className="lg:col-span-2">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Inventory by Blood Type</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {stockData.map((blood, i) => {
                                const percentage = blood.capacity > 0 ? Math.round((blood.units / blood.capacity) * 100) : 0;
                                const isLow = percentage < 30;
                                const isCritical = percentage < 20;
                                const isEditing = editingBloodType === blood.type;

                                return (
                                    <ScrollReveal key={blood.type} delay={i * 0.08} direction="up">
                                        <GlassCard className={`p-5 ${isCritical ? 'border-red-500/40' : ''}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-2xl font-black text-slate-900 dark:text-white">{blood.type}</span>
                                            </div>

                                            <div className="h-24 w-full relative bg-slate-100 dark:bg-white/5 rounded-lg overflow-hidden mb-3">
                                                <motion.div
                                                    className={`absolute bottom-0 w-full bg-gradient-to-t ${COLOR_MAP[blood.type] || 'from-red-500 to-red-600'} rounded-lg`}
                                                    initial={{ height: 0 }}
                                                    whileInView={{ height: `${percentage}%` }}
                                                    transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                                                />
                                                {isCritical && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-red-500 dark:text-red-300 animate-pulse">CRITICAL</span>
                                                    </div>
                                                )}
                                            </div>

                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-xs text-slate-500 dark:text-gray-400 block mb-1">New Units</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={blood.capacity}
                                                            value={updateValues[blood.type] ?? blood.units}
                                                            onChange={(e) => setUpdateValues(prev => ({ ...prev, [blood.type]: parseInt(e.target.value) || 0 }))}
                                                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleUpdateStock(blood.type)}
                                                            className="flex-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded transition-colors"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="flex-1 px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-semibold rounded transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between text-xs mb-3">
                                                        <span className="text-slate-500 dark:text-gray-400">{blood.units} / {blood.capacity}</span>
                                                        <span className={`font-medium ${isCritical ? 'text-red-500' : isLow ? 'text-yellow-500' : 'text-green-500'}`}>
                                                            {percentage}%
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditClick(blood.type)}
                                                            className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded transition-colors"
                                                        >
                                                            ✏️ Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditClick(blood.type)}
                                                            className="flex-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded transition-colors"
                                                        >
                                                            📦 Update
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </GlassCard>
                                    </ScrollReveal>
                                );
                            })}
                        </div>
                    </div>

                    {/* AI Alerts */}
                    <div className="lg:col-span-1">
                        <ScrollReveal direction="right">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">🤖 AI Forecasting Alerts</h2>
                            <div className="space-y-3">
                                {alerts.map((alert, i) => (
                                    <GlassCard key={i} className={`p-4 ${alert.type === 'critical' ? 'border-red-500/40 bg-red-500/5 dark:bg-red-900/10' :
                                            alert.type === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5 dark:bg-yellow-900/10' :
                                                'border-blue-500/20 bg-blue-500/5 dark:bg-blue-900/10'
                                        }`}>
                                        <div className="flex gap-3">
                                            <span className="text-lg">
                                                {alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                                            </span>
                                            <p className="text-sm text-slate-700 dark:text-gray-300">{alert.message}</p>
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </div>
        </div>
    );
}
