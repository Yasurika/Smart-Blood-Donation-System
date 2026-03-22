'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
    AreaChart, Area, Legend,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────
interface KPI {
    totalDonors: number;
    totalHospitals: number;
    totalAppointments: number;
    activeRequests: number;
    totalStock: number;
    totalCampaigns: number;
    recentDonors: number;
    recentAppointments: number;
    recentRequests: number;
    completedAppointments: number;
    cancelledAppointments: number;
    eligibilityReports: number;
    totalNotifications: number;
    completionRate: number;
}

interface ChartItem { _id: string; count: number; totalUnits?: number }

interface DonorUser {
    _id: string;
    name: string;
    email: string;
    bloodType: string;
    phone: string;
    district?: string;
    totalDonations: number;
    xp: number;
    isActive: boolean;
    createdAt: string;
    lastDonationDate?: string;
}

interface HospitalItem {
    _id: string;
    name: string;
    email: string;
    address: string;
    district?: string;
    phone: string;
    isActive: boolean;
    facilities: string[];
    createdAt: string;
}

interface AuditLogItem {
    _id: string;
    userId: string;
    action: string;
    entity: string;
    entityId?: string;
    details: string;
    ipAddress?: string;
    createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────
const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Donors', icon: '👥' },
    { id: 'hospitals', label: 'Hospitals', icon: '🏥' },
    { id: 'audit', label: 'Audit Logs', icon: '📋' },
];

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ─── Main Component ──────────────────────────────────────────────────
export default function AdminDashboardPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [kpi, setKpi] = useState<KPI | null>(null);
    const [charts, setCharts] = useState<Record<string, ChartItem[]>>({});

    // Users state
    const [users, setUsers] = useState<DonorUser[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [userBloodFilter, setUserBloodFilter] = useState('');
    const [userPage, setUserPage] = useState(1);
    const [userTotal, setUserTotal] = useState(0);
    const [usersLoading, setUsersLoading] = useState(false);

    // Hospitals state
    const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
    const [hospitalSearch, setHospitalSearch] = useState('');
    const [hospitalPage, setHospitalPage] = useState(1);
    const [hospitalTotal, setHospitalTotal] = useState(0);
    const [hospitalsLoading, setHospitalsLoading] = useState(false);

    // Audit state
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [auditPage, setAuditPage] = useState(1);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditEntityFilter, setAuditEntityFilter] = useState('');

    // Auth guard
    useEffect(() => {
        if (authStatus === 'loading') return;
        if (!session?.user || session.user.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [session, authStatus, router]);

    // Fetch overview
    useEffect(() => {
        if (session?.user?.role !== 'admin') return;
        (async () => {
            try {
                const res = await fetch('/api/admin/stats?section=overview');
                if (res.ok) {
                    const data = await res.json();
                    setKpi(data.data.kpi);
                    setCharts(data.data.charts);
                }
            } catch { /* ignore */ } finally { setLoading(false); }
        })();
    }, [session]);

    // Fetch users
    const fetchUsers = useCallback(async () => {
        setUsersLoading(true);
        try {
            const params = new URLSearchParams({ section: 'users', page: String(userPage), limit: '15' });
            if (userSearch) params.set('search', userSearch);
            if (userBloodFilter) params.set('bloodType', userBloodFilter);
            const res = await fetch(`/api/admin/stats?${params}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data.data.users);
                setUserTotal(data.data.total);
            }
        } catch { /* ignore */ } finally { setUsersLoading(false); }
    }, [userPage, userSearch, userBloodFilter]);

    useEffect(() => { if (activeTab === 'users') fetchUsers(); }, [activeTab, fetchUsers]);

    // Fetch hospitals
    const fetchHospitals = useCallback(async () => {
        setHospitalsLoading(true);
        try {
            const params = new URLSearchParams({ section: 'hospitals', page: String(hospitalPage), limit: '15' });
            if (hospitalSearch) params.set('search', hospitalSearch);
            const res = await fetch(`/api/admin/stats?${params}`);
            if (res.ok) {
                const data = await res.json();
                setHospitals(data.data.hospitals);
                setHospitalTotal(data.data.total);
            }
        } catch { /* ignore */ } finally { setHospitalsLoading(false); }
    }, [hospitalPage, hospitalSearch]);

    useEffect(() => { if (activeTab === 'hospitals') fetchHospitals(); }, [activeTab, fetchHospitals]);

    // Fetch audit logs
    const fetchAuditLogs = useCallback(async () => {
        setAuditLoading(true);
        try {
            const params = new URLSearchParams({ section: 'audit-logs', page: String(auditPage), limit: '20' });
            if (auditEntityFilter) params.set('entity', auditEntityFilter);
            const res = await fetch(`/api/admin/stats?${params}`);
            if (res.ok) {
                const data = await res.json();
                setAuditLogs(data.data.logs);
                setAuditTotal(data.data.total);
            }
        } catch { /* ignore */ } finally { setAuditLoading(false); }
    }, [auditPage, auditEntityFilter]);

    useEffect(() => { if (activeTab === 'audit') fetchAuditLogs(); }, [activeTab, fetchAuditLogs]);

    // Fetch system
    useEffect(() => {
        if (activeTab !== 'system') return;
        (async () => {
        })();
    }, [activeTab]);

    const toggleUserStatus = async (userId: string, isActive: boolean) => {
        try {
            await fetch(`/api/donors/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });
            fetchUsers();
        } catch { /* ignore */ }
    };

    if (authStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
                    <p className="text-slate-500 dark:text-gray-400 mt-4">Loading Admin Panel...</p>
                </div>
            </div>
        );
    }

    if (session?.user?.role !== 'admin') return null;

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-[1400px] mx-auto">
                {/* Header */}
                <ScrollReveal direction="up">
                    <div className="mb-8">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
                                    <span className="text-white text-lg">🛡️</span>
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-red-500 uppercase tracking-widest">Administrator</span>
                                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                                        System <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Control Panel</span>
                                    </h1>
                                </div>
                            </div>
                            <Link href="/dashboard/hospital-profile">
                                <GlowButton size="sm" className="whitespace-nowrap">
                                    👤 Admin Profile
                                </GlowButton>
                            </Link>
                        </div>
                    </div>
                </ScrollReveal>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                                activeTab === tab.id
                                    ? 'bg-red-500/20 text-red-500 border border-red-500/40'
                                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 border border-transparent hover:bg-slate-200 dark:hover:bg-white/10'
                            }`}
                        >
                            <span>{tab.icon}</span> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'overview' && kpi && <OverviewTab kpi={kpi} charts={charts} />}
                        {activeTab === 'users' && (
                            <UsersTab
                                users={users} total={userTotal} page={userPage} loading={usersLoading}
                                search={userSearch} bloodFilter={userBloodFilter}
                                onSearchChange={setUserSearch} onBloodFilterChange={setUserBloodFilter}
                                onPageChange={setUserPage} onToggleStatus={toggleUserStatus}
                            />
                        )}
                        {activeTab === 'hospitals' && (
                            <HospitalsTab
                                hospitals={hospitals} total={hospitalTotal} page={hospitalPage} loading={hospitalsLoading}
                                search={hospitalSearch} onSearchChange={setHospitalSearch} onPageChange={setHospitalPage}
                            />
                        )}
                        {activeTab === 'audit' && (
                            <AuditTab
                                logs={auditLogs} total={auditTotal} page={auditPage} loading={auditLoading}
                                entityFilter={auditEntityFilter} onEntityFilterChange={setAuditEntityFilter}
                                onPageChange={setAuditPage}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}


// ══════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════
function OverviewTab({ kpi, charts }: { kpi: KPI; charts: Record<string, ChartItem[]> }) {
    const kpiCards = [
        { label: 'Total Donors', value: kpi.totalDonors, icon: '👥', color: 'text-blue-500', bg: 'bg-blue-500/10', sub: `+${kpi.recentDonors} this month` },
        { label: 'Hospitals', value: kpi.totalHospitals, icon: '🏥', color: 'text-green-500', bg: 'bg-green-500/10' },
        { label: 'Appointments', value: kpi.totalAppointments, icon: '📅', color: 'text-purple-500', bg: 'bg-purple-500/10', sub: `${kpi.completionRate}% completion` },
        { label: 'Active Requests', value: kpi.activeRequests, icon: '🚨', color: 'text-red-500', bg: 'bg-red-500/10', sub: `+${kpi.recentRequests} this week` },
        { label: 'Blood Stock', value: kpi.totalStock, icon: '🩸', color: 'text-pink-500', bg: 'bg-pink-500/10', sub: 'available units' },
        { label: 'Campaigns', value: kpi.totalCampaigns, icon: '🎯', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Eligibility Checks', value: kpi.eligibilityReports, icon: '✅', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Notifications Sent', value: kpi.totalNotifications, icon: '🔔', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    ];

    const bloodTypeData = (charts.bloodTypeDistribution || []).map((d: ChartItem) => ({ name: d._id, value: d.count }));
    const stockData = (charts.stockSummary || []).map((d: ChartItem) => ({ name: d._id, units: d.totalUnits }));
    const appointmentStatusData = (charts.appointmentsByStatus || []).map((d: ChartItem) => ({ name: d._id, value: d.count }));
    const urgencyData = (charts.requestsByUrgency || []).map((d: ChartItem) => ({ name: d._id, value: d.count }));
    const regTrend = (charts.registrationTrend || []).map((d: ChartItem) => ({ date: d._id.slice(5), users: d.count }));
    const apptTrend = (charts.appointmentTrend || []).map((d: ChartItem) => ({ date: d._id.slice(5), appts: d.count }));
    const districtData = (charts.districtDistribution || []).map((d: ChartItem) => ({ name: d._id, donors: d.count }));
    const eligibilityData = (charts.eligibilityResults || []).map((d: ChartItem) => ({ name: d._id, value: d.count }));

    return (
        <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpiCards.map((card, i) => (
                    <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <GlassCard className="p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide">{card.label}</p>
                                    <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value.toLocaleString()}</p>
                                    {card.sub && <p className="text-xs text-slate-400 mt-1">{card.sub}</p>}
                                </div>
                                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                                    <span className="text-xl">{card.icon}</span>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                ))}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Registration Trend */}
                <GlassCard className="p-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">📈 Registration Trend (30 days)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={regTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
                            <Area type="monotone" dataKey="users" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </GlassCard>

                {/* Appointment Trend */}
                <GlassCard className="p-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">📅 Appointment Trend (30 days)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={apptTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
                            <Line type="monotone" dataKey="appts" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </GlassCard>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Donor Blood Type Distribution */}
                <GlassCard className="p-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">🩸 Donor Blood Types</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={bloodTypeData} cx="50%" cy="50%" outerRadius={80} label={(props: PieLabelRenderProps) => `${props.name ?? ''} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                                {bloodTypeData.map((_: unknown, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </GlassCard>

                {/* Stock by Blood Type */}
                <GlassCard className="p-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">📦 Stock Levels</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={stockData}>
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
                            <Bar dataKey="units" fill="#ef4444" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </GlassCard>

                {/* Appointment Status */}
                <GlassCard className="p-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">📊 Appointment Status</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={appointmentStatusData} cx="50%" cy="50%" outerRadius={80} label={(props: PieLabelRenderProps) => `${props.name ?? ''}: ${props.value ?? 0}`} labelLine={false}>
                                {appointmentStatusData.map((_: unknown, i: number) => <Cell key={i} fill={['#22c55e', '#3b82f6', '#ef4444', '#eab308'][i % 4]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </GlassCard>
            </div>

            {/* Charts Row 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Districts */}
                <GlassCard className="p-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">📍 Top Districts (Donors)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={districtData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#9ca3af' }} width={90} />
                            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
                            <Bar dataKey="donors" fill="#06b6d4" radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </GlassCard>

                {/* Urgency & Eligibility */}
                <div className="space-y-6">
                    <GlassCard className="p-6">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">🚨 Active Requests by Urgency</h3>
                        <div className="flex gap-3">
                            {urgencyData.length > 0 ? urgencyData.map((d: { name: string; value: number }) => (
                                <div key={d.name} className={`flex-1 p-3 rounded-xl text-center ${
                                    d.name === 'Critical' ? 'bg-red-500/10' : d.name === 'High' ? 'bg-orange-500/10' : d.name === 'Medium' ? 'bg-yellow-500/10' : 'bg-green-500/10'
                                }`}>
                                    <p className={`text-xl font-bold ${
                                        d.name === 'Critical' ? 'text-red-500' : d.name === 'High' ? 'text-orange-500' : d.name === 'Medium' ? 'text-yellow-500' : 'text-green-500'
                                    }`}>{d.value}</p>
                                    <p className="text-xs text-slate-500 dark:text-gray-400">{d.name}</p>
                                </div>
                            )) : <p className="text-sm text-slate-400">No active requests</p>}
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">✅ Eligibility Results</h3>
                        <div className="space-y-2">
                            {eligibilityData.length > 0 ? eligibilityData.map((d: { name: string; value: number }) => {
                                const total = eligibilityData.reduce((s: number, x: { value: number }) => s + x.value, 0);
                                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                                const color = d.name.includes('Eligible to') ? 'bg-green-500' : d.name.includes('Preliminary') ? 'bg-yellow-500' : 'bg-red-500';
                                return (
                                    <div key={d.name}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-600 dark:text-gray-400 truncate mr-2">{d.name}</span>
                                            <span className="text-slate-500 shrink-0">{d.value} ({pct}%)</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            }) : <p className="text-sm text-slate-400">No eligibility data yet</p>}
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}


// ══════════════════════════════════════════════════════════════════════
// USERS TAB
// ══════════════════════════════════════════════════════════════════════
function UsersTab({ users, total, page, loading, search, bloodFilter, onSearchChange, onBloodFilterChange, onPageChange, onToggleStatus }: {
    users: DonorUser[]; total: number; page: number; loading: boolean;
    search: string; bloodFilter: string;
    onSearchChange: (v: string) => void; onBloodFilterChange: (v: string) => void;
    onPageChange: (v: number) => void; onToggleStatus: (id: string, isActive: boolean) => void;
}) {
    const totalPages = Math.ceil(total / 15);

    return (
        <div className="space-y-6">
            {/* Filters */}
            <GlassCard className="p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        type="text"
                        placeholder="Search donors by name..."
                        value={search}
                        onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:border-red-500/50 outline-none text-sm"
                    />
                    <select
                        value={bloodFilter}
                        onChange={(e) => { onBloodFilterChange(e.target.value); onPageChange(1); }}
                        className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm appearance-none"
                    >
                        <option value="">All Blood Types</option>
                        {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                    </select>
                    <div className="text-sm text-slate-500 dark:text-gray-400 self-center whitespace-nowrap">
                        {total} donor{total !== 1 ? 's' : ''} found
                    </div>
                </div>
            </GlassCard>

            {/* Table */}
            <GlassCard className="p-0 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/10">
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">Name</th>
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">Blood</th>
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase hidden md:table-cell">District</th>
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase hidden lg:table-cell">Phone</th>
                                    <th className="text-center p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">Donations</th>
                                    <th className="text-center p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">XP</th>
                                    <th className="text-center p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">Status</th>
                                    <th className="text-center p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{user.name}</p>
                                                <p className="text-xs text-slate-400">{user.email}</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold">{user.bloodType}</span>
                                        </td>
                                        <td className="p-4 hidden md:table-cell text-slate-600 dark:text-gray-400">{user.district || '—'}</td>
                                        <td className="p-4 hidden lg:table-cell text-slate-600 dark:text-gray-400">{user.phone}</td>
                                        <td className="p-4 text-center font-semibold text-slate-900 dark:text-white">{user.totalDonations}</td>
                                        <td className="p-4 text-center">
                                            <span className="text-amber-500 font-medium">{user.xp}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => onToggleStatus(user._id, user.isActive)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                    user.isActive
                                                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                                        : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                                }`}
                                            >
                                                {user.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <GlowButton variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>← Prev</GlowButton>
                    <span className="text-sm text-slate-500 dark:text-gray-400 px-3">Page {page} of {totalPages}</span>
                    <GlowButton variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Next →</GlowButton>
                </div>
            )}
        </div>
    );
}


// ══════════════════════════════════════════════════════════════════════
// HOSPITALS TAB
// ══════════════════════════════════════════════════════════════════════
function HospitalsTab({ hospitals, total, page, loading, search, onSearchChange, onPageChange }: {
    hospitals: HospitalItem[]; total: number; page: number; loading: boolean;
    search: string; onSearchChange: (v: string) => void; onPageChange: (v: number) => void;
}) {
    const totalPages = Math.ceil(total / 15);

    return (
        <div className="space-y-6">
            <GlassCard className="p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        type="text"
                        placeholder="Search hospitals by name..."
                        value={search}
                        onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:border-red-500/50 outline-none text-sm"
                    />
                    <div className="text-sm text-slate-500 dark:text-gray-400 self-center whitespace-nowrap">
                        {total} hospital{total !== 1 ? 's' : ''}
                    </div>
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                    <div className="col-span-2 p-12 text-center">
                        <div className="w-8 h-8 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
                    </div>
                ) : hospitals.map(h => (
                    <GlassCard key={h._id} className="p-5">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">{h.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{h.email}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${h.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {h.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600 dark:text-gray-400">
                            <p>📍 {h.address}</p>
                            {h.district && <p>🗺️ {h.district}</p>}
                            <p>📞 {h.phone}</p>
                            <p>📅 Joined {new Date(h.createdAt).toLocaleDateString()}</p>
                        </div>
                        {h.facilities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {h.facilities.map(f => (
                                    <span key={f} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-medium">{f}</span>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <GlowButton variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>← Prev</GlowButton>
                    <span className="text-sm text-slate-500 dark:text-gray-400 px-3">Page {page} of {totalPages}</span>
                    <GlowButton variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Next →</GlowButton>
                </div>
            )}
        </div>
    );
}


// ══════════════════════════════════════════════════════════════════════
// AUDIT LOGS TAB
// ══════════════════════════════════════════════════════════════════════
function AuditTab({ logs, total, page, loading, entityFilter, onEntityFilterChange, onPageChange }: {
    logs: AuditLogItem[]; total: number; page: number; loading: boolean;
    entityFilter: string; onEntityFilterChange: (v: string) => void; onPageChange: (v: number) => void;
}) {
    const totalPages = Math.ceil(total / 20);
    const entities = ['', 'Appointment', 'BloodRequest', 'BloodStock', 'Campaign', 'User', 'Hospital'];

    const actionColors: Record<string, string> = {
        CREATE: 'bg-green-500/10 text-green-500',
        UPDATE: 'bg-blue-500/10 text-blue-500',
        DELETE: 'bg-red-500/10 text-red-500',
        LOGIN: 'bg-purple-500/10 text-purple-500',
    };

    return (
        <div className="space-y-6">
            <GlassCard className="p-4">
                <div className="flex flex-col md:flex-row gap-3 items-center">
                    <select
                        value={entityFilter}
                        onChange={(e) => { onEntityFilterChange(e.target.value); onPageChange(1); }}
                        className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm appearance-none"
                    >
                        <option value="">All Entities</option>
                        {entities.filter(Boolean).map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <div className="text-sm text-slate-500 dark:text-gray-400">{total} log entries</div>
                </div>
            </GlassCard>

            <GlassCard className="p-0 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/10">
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">Time</th>
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">Action</th>
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">Entity</th>
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase hidden md:table-cell">Details</th>
                                    <th className="text-left p-4 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase hidden lg:table-cell">IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${actionColors[log.action] || 'bg-slate-500/10 text-slate-500'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-600 dark:text-gray-400 text-xs">{log.entity}</td>
                                        <td className="p-4 hidden md:table-cell text-xs text-slate-500 dark:text-gray-400 max-w-xs truncate">{log.details}</td>
                                        <td className="p-4 hidden lg:table-cell text-xs text-slate-400 font-mono">{log.ipAddress || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <GlowButton variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>← Prev</GlowButton>
                    <span className="text-sm text-slate-500 dark:text-gray-400 px-3">Page {page} of {totalPages}</span>
                    <GlowButton variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Next →</GlowButton>
                </div>
            )}
        </div>
    );
}
