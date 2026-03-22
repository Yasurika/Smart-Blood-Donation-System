'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import AnimatedCounter from '@/components/animations/AnimatedCounter';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const COMPONENTS = ['Whole Blood', 'Red Cells', 'Platelets', 'Plasma', 'Cryoprecipitate'] as const;
const STATUSES = ['Available', 'Reserved', 'Transfused', 'Expired', 'Discarded'] as const;

interface StockEntry {
    _id: string;
    hospitalId: { _id: string; name: string; address: string } | string;
    bloodType: string;
    units: number;
    status: string;
    barcode: string;
    expiryDate: string;
    donorId?: { _id: string; name: string; bloodType: string } | string;
    collectedAt: string;
    component: string;
    temperature?: number;
    createdAt: string;
}

interface SummaryItem {
    _id: string;
    totalUnits: number;
    count: number;
    nearestExpiry: string | null;
}

type ModalMode = 'add' | 'edit' | 'view' | null;

const STATUS_COLORS: Record<string, string> = {
    Available: 'bg-green-500/10 text-green-500',
    Reserved: 'bg-blue-500/10 text-blue-500',
    Transfused: 'bg-purple-500/10 text-purple-500',
    Expired: 'bg-red-500/10 text-red-500',
    Discarded: 'bg-slate-500/10 text-slate-400',
};

const BT_COLORS: Record<string, string> = {
    'A+': 'bg-red-500/15 text-red-500', 'A-': 'bg-red-600/15 text-red-600',
    'B+': 'bg-blue-500/15 text-blue-500', 'B-': 'bg-blue-600/15 text-blue-600',
    'AB+': 'bg-purple-500/15 text-purple-500', 'AB-': 'bg-purple-600/15 text-purple-600',
    'O+': 'bg-green-500/15 text-green-500', 'O-': 'bg-orange-500/15 text-orange-500',
};

const BAR_COLORS: Record<string, string> = {
    'A+': 'from-red-500 to-red-600', 'A-': 'from-red-400 to-red-500',
    'B+': 'from-blue-500 to-blue-600', 'B-': 'from-blue-400 to-blue-500',
    'AB+': 'from-purple-500 to-purple-600', 'AB-': 'from-purple-400 to-purple-500',
    'O+': 'from-green-500 to-green-600', 'O-': 'from-orange-500 to-orange-600',
};

interface AddForm {
    bloodType: string;
    units: number;
    barcode: string;
    expiryDate: string;
    component: string;
    donorId: string;
    temperature: string;
}

const initialAddForm: AddForm = {
    bloodType: 'O+',
    units: 1,
    barcode: '',
    expiryDate: '',
    component: 'Whole Blood',
    donorId: '',
    temperature: '',
};

export default function StockManagePage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();

    // Data state
    const [entries, setEntries] = useState<StockEntry[]>([]);
    const [summary, setSummary] = useState<SummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Filters
    const [filterBloodType, setFilterBloodType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterExpiring, setFilterExpiring] = useState('');

    // Modal
    const [modal, setModal] = useState<ModalMode>(null);
    const [selectedEntry, setSelectedEntry] = useState<StockEntry | null>(null);
    const [addForm, setAddForm] = useState<AddForm>(initialAddForm);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Tab
    const [activeTab, setActiveTab] = useState<'inventory' | 'overview'>('overview');

    const hospitalId = session?.user?.id || '';

    const fetchStock = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '15' });
            if (hospitalId) params.set('hospitalId', hospitalId);
            if (filterBloodType) params.set('bloodType', filterBloodType);
            if (filterStatus) params.set('status', filterStatus);
            if (filterExpiring) params.set('expiringSoon', filterExpiring);

            const res = await fetch(`/api/stock?${params}`);
            if (res.ok) {
                const json = await res.json();
                setEntries(json.data?.stock || []);
                setSummary(json.data?.summary || []);
                setTotalPages(json.pagination?.totalPages || 1);
                setTotalItems(json.pagination?.total || 0);
            }
        } catch (err) {
            console.error('Failed to fetch stock:', err);
        } finally {
            setLoading(false);
        }
    }, [page, hospitalId, filterBloodType, filterStatus, filterExpiring]);

    useEffect(() => { fetchStock(); }, [fetchStock]);
    useEffect(() => { setPage(1); }, [filterBloodType, filterStatus, filterExpiring]);

    // Auth guard
    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!session?.user) { router.replace('/login'); return null; }

    const role = (session.user as { role?: string }).role;
    if (role !== 'hospital' && role !== 'admin') {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <GlassCard className="p-10 text-center max-w-md">
                    <span className="text-5xl block mb-4">🔒</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-slate-500 dark:text-gray-400 mb-6">Only hospitals and admins can manage blood stock.</p>
                    <GlowButton variant="secondary" onClick={() => router.push('/dashboard')}>Back to Dashboard</GlowButton>
                </GlassCard>
            </div>
        );
    }

    // Summary calculations
    const totalUnits = summary.reduce((s, i) => s + i.totalUnits, 0);
    const totalBags = summary.reduce((s, i) => s + i.count, 0);
    const expiringCount = entries.filter(e => {
        if (e.status !== 'Available') return false;
        const days = (new Date(e.expiryDate).getTime() - Date.now()) / 86400000;
        return days <= 7 && days > 0;
    }).length;
    const criticalTypes = BLOOD_TYPES.filter(bt => {
        const found = summary.find(s => s._id === bt);
        return !found || found.totalUnits < 5;
    });

    function generateBarcode() {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        setAddForm(prev => ({ ...prev, barcode: `SB-${prev.bloodType.replace('+', 'P').replace('-', 'N')}-${ts}-${rand}` }));
    }

    function validateAdd(): boolean {
        const errs: Record<string, string> = {};
        if (!addForm.barcode || addForm.barcode.length < 5) errs.barcode = 'Barcode required (min 5 chars)';
        if (addForm.units < 1 || addForm.units > 1000) errs.units = 'Units must be 1-1000';
        if (!addForm.expiryDate) errs.expiryDate = 'Expiry date is required';
        else if (new Date(addForm.expiryDate) <= new Date()) errs.expiryDate = 'Must be a future date';
        if (addForm.donorId && !/^[a-fA-F0-9]{24}$/.test(addForm.donorId)) errs.donorId = 'Must be a valid 24-character ID';
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleAddStock(e: React.FormEvent) {
        e.preventDefault();
        setServerError('');
        if (!validateAdd()) return;

        setSubmitting(true);
        try {
            const payload: Record<string, unknown> = {
                hospitalId,
                bloodType: addForm.bloodType,
                units: addForm.units,
                barcode: addForm.barcode,
                expiryDate: addForm.expiryDate,
            };
            if (addForm.donorId && /^[a-fA-F0-9]{24}$/.test(addForm.donorId)) payload.donorId = addForm.donorId;

            const res = await fetch('/api/stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok) { setServerError(json.error || 'Failed to add stock'); return; }

            setSuccessMsg(`Added ${addForm.units} unit(s) of ${addForm.bloodType} successfully!`);
            setModal(null);
            setAddForm(initialAddForm);
            fetchStock();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch {
            setServerError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUpdateStatus(id: string, newStatus: string) {
        try {
            const res = await fetch(`/api/stock/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setSuccessMsg(`Stock status updated to ${newStatus}`);
                setSelectedEntry(null);
                setModal(null);
                fetchStock();
                setTimeout(() => setSuccessMsg(''), 4000);
            }
        } catch (err) {
            console.error('Update failed:', err);
        }
    }

    async function handleDiscard(id: string) {
        if (!confirm('Are you sure you want to discard this stock entry? This action cannot be undone.')) return;
        try {
            const res = await fetch(`/api/stock/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setSuccessMsg('Stock discarded successfully');
                setSelectedEntry(null);
                setModal(null);
                fetchStock();
                setTimeout(() => setSuccessMsg(''), 4000);
            }
        } catch (err) {
            console.error('Discard failed:', err);
        }
    }

    function openView(entry: StockEntry) { setSelectedEntry(entry); setModal('view'); }
    function openEdit(entry: StockEntry) { setSelectedEntry(entry); setModal('edit'); }

    function getDaysUntilExpiry(date: string) {
        return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    }

    function getExpiryBadge(date: string) {
        const days = getDaysUntilExpiry(date);
        if (days <= 0) return { text: 'Expired', cls: 'bg-red-500/20 text-red-500' };
        if (days <= 3) return { text: `${days}d left`, cls: 'bg-red-500/15 text-red-500 animate-pulse' };
        if (days <= 7) return { text: `${days}d left`, cls: 'bg-yellow-500/15 text-yellow-500' };
        if (days <= 14) return { text: `${days}d left`, cls: 'bg-orange-500/10 text-orange-500' };
        return { text: `${days}d`, cls: 'bg-green-500/10 text-green-500' };
    }

    const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all';

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <ScrollReveal direction="up">
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                        <div>
                            <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Hospital</span>
                            <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                Stock{' '}
                                <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">
                                    Management
                                </span>
                            </h1>
                            <p className="mt-2 text-slate-500 dark:text-gray-400">Add, track, and manage blood stock inventory.</p>
                        </div>
                        <GlowButton variant="primary" size="lg" onClick={() => { setAddForm(initialAddForm); setFormErrors({}); setServerError(''); setModal('add'); }}>
                            + Add Stock Entry
                        </GlowButton>
                    </div>
                </ScrollReveal>

                {/* Success Toast */}
                <AnimatePresence>
                    {successMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-2"
                        >
                            <span>✅</span> {successMsg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Summary Cards */}
                <ScrollReveal direction="up" delay={0.05}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: 'Total Units', value: totalUnits, icon: '🩸', color: 'text-red-500' },
                            { label: 'Stock Entries', value: totalBags, icon: '📦', color: 'text-blue-500' },
                            { label: 'Expiring (7d)', value: expiringCount, icon: '⏰', color: expiringCount > 0 ? 'text-yellow-500' : 'text-green-500' },
                            { label: 'Critical Types', value: criticalTypes.length, icon: '🚨', color: criticalTypes.length > 0 ? 'text-red-500' : 'text-green-500' },
                        ].map((stat, i) => (
                            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                                <GlassCard className="p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-gray-400">{stat.label}</p>
                                            <AnimatedCounter target={stat.value} className={`text-2xl font-bold ${stat.color}`} />
                                        </div>
                                        <span className="text-2xl">{stat.icon}</span>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        ))}
                    </div>
                </ScrollReveal>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {(['overview', 'inventory'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                activeTab === tab
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                    : 'bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:border-red-500/50'
                            }`}
                        >
                            {tab === 'overview' ? '📊 Overview' : '📋 Inventory'}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <ScrollReveal direction="up" delay={0.1}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {BLOOD_TYPES.map((bt, i) => {
                                const found = summary.find(s => s._id === bt);
                                const units = found?.totalUnits || 0;
                                const count = found?.count || 0;
                                const maxUnits = Math.max(...summary.map(s => s.totalUnits), 1);
                                const pct = Math.round((units / maxUnits) * 100);
                                const nearestExpiry = found?.nearestExpiry;
                                const daysToExpiry = nearestExpiry ? getDaysUntilExpiry(nearestExpiry) : null;

                                return (
                                    <motion.div key={bt} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                                        <GlassCard className={`p-5 ${units === 0 ? 'border-red-500/30' : ''}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${BT_COLORS[bt]}`}>{bt}</span>
                                                <span className="text-xs text-slate-400 dark:text-gray-500">{count} bags</span>
                                            </div>
                                            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{units}</p>
                                            <p className="text-xs text-slate-400 dark:text-gray-500 mb-3">units available</p>

                                            {/* Bar */}
                                            <div className="h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden mb-2">
                                                <motion.div
                                                    className={`h-full bg-gradient-to-r ${BAR_COLORS[bt]} rounded-full`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.8, delay: 0.2 }}
                                                />
                                            </div>

                                            {daysToExpiry !== null && daysToExpiry <= 14 && (
                                                <p className={`text-[10px] font-medium ${daysToExpiry <= 3 ? 'text-red-500' : 'text-yellow-500'}`}>
                                                    ⏰ Nearest expiry: {daysToExpiry}d
                                                </p>
                                            )}
                                            {units === 0 && (
                                                <p className="text-[10px] font-semibold text-red-500 animate-pulse">⚠ OUT OF STOCK</p>
                                            )}
                                        </GlassCard>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Critical Alerts */}
                        {criticalTypes.length > 0 && (
                            <GlassCard className="p-5 mb-6 border-red-500/30 bg-red-500/5">
                                <h3 className="text-sm font-bold text-red-500 mb-3">🚨 Critical Stock Alerts</h3>
                                <div className="space-y-2">
                                    {criticalTypes.map(bt => {
                                        const found = summary.find(s => s._id === bt);
                                        return (
                                            <div key={bt} className="flex items-center gap-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${BT_COLORS[bt]}`}>{bt}</span>
                                                <span className="text-slate-600 dark:text-gray-300">
                                                    {found ? `Only ${found.totalUnits} unit(s) remaining` : 'No stock available'} — immediate restocking needed
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </GlassCard>
                        )}
                    </ScrollReveal>
                )}

                {/* INVENTORY TAB */}
                {activeTab === 'inventory' && (
                    <>
                        {/* Filters */}
                        <ScrollReveal direction="up" delay={0.1}>
                            <GlassCard className="p-4 mb-6">
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex gap-2 flex-wrap flex-1">
                                        <select
                                            value={filterBloodType}
                                            onChange={e => setFilterBloodType(e.target.value)}
                                            className={`${inputClass} !w-auto min-w-[120px]`}
                                        >
                                            <option value="">All Types</option>
                                            {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                                        </select>

                                        <select
                                            value={filterStatus}
                                            onChange={e => setFilterStatus(e.target.value)}
                                            className={`${inputClass} !w-auto min-w-[140px]`}
                                        >
                                            <option value="">All Status</option>
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>

                                        <select
                                            value={filterExpiring}
                                            onChange={e => setFilterExpiring(e.target.value)}
                                            className={`${inputClass} !w-auto min-w-[160px]`}
                                        >
                                            <option value="">Expiry Filter</option>
                                            <option value="3">Expiring in 3 days</option>
                                            <option value="7">Expiring in 7 days</option>
                                            <option value="14">Expiring in 14 days</option>
                                            <option value="30">Expiring in 30 days</option>
                                        </select>
                                    </div>

                                    {(filterBloodType || filterStatus || filterExpiring) && (
                                        <button
                                            onClick={() => { setFilterBloodType(''); setFilterStatus(''); setFilterExpiring(''); }}
                                            className="text-sm text-red-500 hover:text-red-400 transition-colors whitespace-nowrap"
                                        >
                                            ✕ Clear Filters
                                        </button>
                                    )}
                                </div>
                            </GlassCard>
                        </ScrollReveal>

                        {/* Stock Table */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                            </div>
                        ) : entries.length > 0 ? (
                            <>
                                {/* Mobile cards / Desktop table */}
                                <div className="hidden md:block">
                                    <GlassCard className="overflow-hidden" hover={false}>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-slate-200 dark:border-white/10">
                                                        {['Barcode', 'Blood Type', 'Units', 'Component', 'Status', 'Expiry', 'Collected', 'Actions'].map(h => (
                                                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {entries.map((entry, i) => {
                                                        const expiry = getExpiryBadge(entry.expiryDate);
                                                        return (
                                                            <motion.tr
                                                                key={entry._id}
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                transition={{ delay: i * 0.03 }}
                                                                className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                                                            >
                                                                <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-gray-300">{entry.barcode}</td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${BT_COLORS[entry.bloodType]}`}>
                                                                        {entry.bloodType}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{entry.units}</td>
                                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-gray-400">{entry.component || 'Whole Blood'}</td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[entry.status]}`}>
                                                                        {entry.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${expiry.cls}`}>
                                                                        {expiry.text}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-400">
                                                                    {new Date(entry.collectedAt).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex gap-1">
                                                                        <button onClick={() => openView(entry)} className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-500 transition-colors" title="View">
                                                                            👁️
                                                                        </button>
                                                                        {entry.status === 'Available' && (
                                                                            <>
                                                                                <button onClick={() => openEdit(entry)} className="p-1.5 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-500/10 text-blue-500 transition-colors" title="Update">
                                                                                    ✏️
                                                                                </button>
                                                                                <button onClick={() => handleDiscard(entry._id)} className="p-1.5 rounded-lg hover:bg-red-100/50 dark:hover:bg-red-500/10 text-red-500 transition-colors" title="Discard">
                                                                                    🗑️
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </motion.tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </GlassCard>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-3">
                                    {entries.map((entry, i) => {
                                        const expiry = getExpiryBadge(entry.expiryDate);
                                        return (
                                            <ScrollReveal key={entry._id} delay={i * 0.05} direction="up">
                                                <GlassCard className="p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${BT_COLORS[entry.bloodType]}`}>{entry.bloodType}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[entry.status]}`}>{entry.status}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                                                        <div>
                                                            <p className="text-[10px] uppercase text-slate-400">Barcode</p>
                                                            <p className="font-mono text-xs text-slate-700 dark:text-gray-300 truncate">{entry.barcode}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase text-slate-400">Units</p>
                                                            <p className="font-bold text-slate-900 dark:text-white">{entry.units}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase text-slate-400">Component</p>
                                                            <p className="text-slate-600 dark:text-gray-400 text-xs">{entry.component || 'Whole Blood'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase text-slate-400">Expiry</p>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${expiry.cls}`}>{expiry.text}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <GlowButton variant="outline" size="sm" className="flex-1" onClick={() => openView(entry)}>View</GlowButton>
                                                        {entry.status === 'Available' && (
                                                            <>
                                                                <GlowButton variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(entry)}>Edit</GlowButton>
                                                                <GlowButton variant="danger" size="sm" onClick={() => handleDiscard(entry._id)}>✕</GlowButton>
                                                            </>
                                                        )}
                                                    </div>
                                                </GlassCard>
                                            </ScrollReveal>
                                        );
                                    })}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-3 mt-8">
                                        <GlowButton variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                                            ← Prev
                                        </GlowButton>
                                        <span className="text-sm text-slate-500 dark:text-gray-400">
                                            Page {page} of {totalPages} ({totalItems} items)
                                        </span>
                                        <GlowButton variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                                            Next →
                                        </GlowButton>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-20">
                                <span className="text-6xl block mb-4">📦</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Stock Entries</h3>
                                <p className="text-slate-500 dark:text-gray-400 mb-6">
                                    {filterBloodType || filterStatus || filterExpiring ? 'No entries match your filters.' : 'Add your first blood stock entry to get started.'}
                                </p>
                                <GlowButton variant="primary" onClick={() => { setAddForm(initialAddForm); setModal('add'); }}>
                                    + Add First Entry
                                </GlowButton>
                            </div>
                        )}
                    </>
                )}

                {/* ═══════ MODALS ═══════ */}
                <AnimatePresence>
                    {modal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
                            onClick={() => { setModal(null); setSelectedEntry(null); }}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                onClick={e => e.stopPropagation()}
                                className="w-full max-w-lg my-8"
                            >
                                <GlassCard className="p-6" hover={false}>
                                    {/* ADD STOCK */}
                                    {modal === 'add' && (
                                        <>
                                            <div className="flex items-center justify-between mb-6">
                                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">🩸 Add Blood Stock</h2>
                                                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-slate-200/50 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors">✕</button>
                                            </div>

                                            {serverError && (
                                                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{serverError}</div>
                                            )}

                                            <form onSubmit={handleAddStock} className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Blood Type *</label>
                                                        <select
                                                            value={addForm.bloodType}
                                                            onChange={e => setAddForm(prev => ({ ...prev, bloodType: e.target.value }))}
                                                            className={inputClass}
                                                        >
                                                            {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Units *</label>
                                                        <input
                                                            type="number"
                                                            value={addForm.units}
                                                            onChange={e => setAddForm(prev => ({ ...prev, units: Number(e.target.value) }))}
                                                            min={1} max={1000}
                                                            className={inputClass}
                                                        />
                                                        {formErrors.units && <p className="mt-1 text-xs text-red-500">{formErrors.units}</p>}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Barcode *</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={addForm.barcode}
                                                            onChange={e => setAddForm(prev => ({ ...prev, barcode: e.target.value }))}
                                                            placeholder="Scan or generate barcode"
                                                            className={`${inputClass} flex-1`}
                                                        />
                                                        <button type="button" onClick={generateBarcode} className="px-4 py-2 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-gray-400 hover:border-red-500/50 transition-all whitespace-nowrap">
                                                            Generate
                                                        </button>
                                                    </div>
                                                    {formErrors.barcode && <p className="mt-1 text-xs text-red-500">{formErrors.barcode}</p>}
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Expiry Date *</label>
                                                        <input
                                                            type="date"
                                                            value={addForm.expiryDate}
                                                            onChange={e => setAddForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                                                            className={inputClass}
                                                        />
                                                        {formErrors.expiryDate && <p className="mt-1 text-xs text-red-500">{formErrors.expiryDate}</p>}
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Component</label>
                                                        <select
                                                            value={addForm.component}
                                                            onChange={e => setAddForm(prev => ({ ...prev, component: e.target.value }))}
                                                            className={inputClass}
                                                        >
                                                            {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                                                        Donor ID <span className="text-slate-400 font-normal">(optional)</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={addForm.donorId}
                                                        onChange={e => setAddForm(prev => ({ ...prev, donorId: e.target.value }))}
                                                        placeholder="24-character MongoDB ObjectId"
                                                        className={inputClass}
                                                        maxLength={24}
                                                    />
                                                    {formErrors.donorId && <p className="mt-1 text-xs text-red-500">{formErrors.donorId}</p>}
                                                </div>

                                                <div className="flex gap-3 pt-2">
                                                    <GlowButton type="submit" variant="primary" size="lg" className="flex-1" disabled={submitting}>
                                                        {submitting ? 'Adding...' : '🩸 Add Stock'}
                                                    </GlowButton>
                                                    <GlowButton type="button" variant="outline" size="lg" onClick={() => setModal(null)} disabled={submitting}>
                                                        Cancel
                                                    </GlowButton>
                                                </div>
                                            </form>
                                        </>
                                    )}

                                    {/* VIEW STOCK */}
                                    {modal === 'view' && selectedEntry && (
                                        <>
                                            <div className="flex items-center justify-between mb-6">
                                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Stock Details</h2>
                                                <button onClick={() => { setModal(null); setSelectedEntry(null); }} className="w-8 h-8 rounded-full bg-slate-200/50 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors">✕</button>
                                            </div>

                                            <div className="flex items-center gap-3 mb-6">
                                                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${BT_COLORS[selectedEntry.bloodType]}`}>{selectedEntry.bloodType}</span>
                                                <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${STATUS_COLORS[selectedEntry.status]}`}>{selectedEntry.status}</span>
                                                {(() => { const exp = getExpiryBadge(selectedEntry.expiryDate); return <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${exp.cls}`}>{exp.text}</span>; })()}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                {[
                                                    { label: 'Barcode', value: selectedEntry.barcode, icon: '🔖' },
                                                    { label: 'Units', value: String(selectedEntry.units), icon: '🩸' },
                                                    { label: 'Component', value: selectedEntry.component || 'Whole Blood', icon: '🧬' },
                                                    { label: 'Collected', value: new Date(selectedEntry.collectedAt).toLocaleDateString(), icon: '📅' },
                                                    { label: 'Expires', value: new Date(selectedEntry.expiryDate).toLocaleDateString(), icon: '⏰' },
                                                    { label: 'Hospital', value: typeof selectedEntry.hospitalId === 'object' ? selectedEntry.hospitalId.name : selectedEntry.hospitalId, icon: '🏥' },
                                                    ...(selectedEntry.donorId ? [{ label: 'Donor', value: typeof selectedEntry.donorId === 'object' ? selectedEntry.donorId.name : selectedEntry.donorId, icon: '👤' }] : []),
                                                    ...(selectedEntry.temperature != null ? [{ label: 'Temperature', value: `${selectedEntry.temperature}°C`, icon: '🌡️' }] : []),
                                                ].map(item => (
                                                    <div key={item.label} className="flex items-center gap-2 p-3 rounded-xl bg-slate-100/50 dark:bg-white/5">
                                                        <span className="text-lg">{item.icon}</span>
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] uppercase text-slate-400 dark:text-gray-500">{item.label}</p>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex gap-3">
                                                {selectedEntry.status === 'Available' && (
                                                    <>
                                                        <GlowButton variant="primary" size="sm" className="flex-1" onClick={() => openEdit(selectedEntry)}>✏️ Update Status</GlowButton>
                                                        <GlowButton variant="danger" size="sm" onClick={() => handleDiscard(selectedEntry._id)}>🗑️ Discard</GlowButton>
                                                    </>
                                                )}
                                                <GlowButton variant="outline" size="sm" className="flex-1" onClick={() => { setModal(null); setSelectedEntry(null); }}>Close</GlowButton>
                                            </div>
                                        </>
                                    )}

                                    {/* EDIT STATUS */}
                                    {modal === 'edit' && selectedEntry && (
                                        <>
                                            <div className="flex items-center justify-between mb-6">
                                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Update Stock Status</h2>
                                                <button onClick={() => { setModal(null); setSelectedEntry(null); }} className="w-8 h-8 rounded-full bg-slate-200/50 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors">✕</button>
                                            </div>

                                            <div className="flex items-center gap-3 mb-6">
                                                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${BT_COLORS[selectedEntry.bloodType]}`}>{selectedEntry.bloodType}</span>
                                                <span className="text-sm text-slate-500 dark:text-gray-400">Barcode: <span className="font-mono">{selectedEntry.barcode}</span></span>
                                            </div>

                                            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                                                Current status: <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[selectedEntry.status]}`}>{selectedEntry.status}</span>
                                            </p>

                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                {STATUSES.filter(s => s !== selectedEntry.status).map(status => (
                                                    <button
                                                        key={status}
                                                        onClick={() => handleUpdateStatus(selectedEntry._id, status)}
                                                        className={`p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                                                            status === 'Available' ? 'border-green-500/30 hover:bg-green-500/10' :
                                                            status === 'Reserved' ? 'border-blue-500/30 hover:bg-blue-500/10' :
                                                            status === 'Transfused' ? 'border-purple-500/30 hover:bg-purple-500/10' :
                                                            status === 'Expired' ? 'border-red-500/30 hover:bg-red-500/10' :
                                                            'border-slate-300/30 hover:bg-slate-500/10'
                                                        }`}
                                                    >
                                                        <span className={`text-sm font-semibold ${
                                                            status === 'Available' ? 'text-green-500' :
                                                            status === 'Reserved' ? 'text-blue-500' :
                                                            status === 'Transfused' ? 'text-purple-500' :
                                                            status === 'Expired' ? 'text-red-500' : 'text-slate-400'
                                                        }`}>
                                                            {status === 'Available' ? '✅' : status === 'Reserved' ? '📌' : status === 'Transfused' ? '💉' : status === 'Expired' ? '⏰' : '🗑️'} {status}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>

                                            <GlowButton variant="outline" size="sm" className="w-full" onClick={() => { setModal(null); setSelectedEntry(null); }}>
                                                Cancel
                                            </GlowButton>
                                        </>
                                    )}
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
