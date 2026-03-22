'use client';

import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import AnimatedCounter from '@/components/animations/AnimatedCounter';
import ScrollReveal from '@/components/animations/ScrollReveal';
import Link from 'next/link';
import type { HospitalDashboardData } from '@/lib/data/dashboard';

interface HospitalDashboardProps {
    data: HospitalDashboardData;
}

const quickActions = [
    { label: 'My Profile', href: '/dashboard/hospital-profile', icon: '👤', color: 'from-purple-500/20' },
    { label: 'Manage Stock', href: '/dashboard/stock', icon: '🩸', color: 'from-red-500/20' },
    { label: 'Blood Requests', href: '/dashboard/requests', icon: '🚑', color: 'from-orange-500/20' },
    { label: 'Organize Campaign', href: '/dashboard/campaigns/new', icon: '🏕️', color: 'from-green-500/20' },
    { label: 'Donor Database', href: '/dashboard/donors', icon: '👥', color: 'from-blue-500/20' },
];

export default function HospitalDashboard({ data }: HospitalDashboardProps) {
    const { hospital, stats, recentRequests, lowStockAlerts } = data;

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-10"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Hospital Portal: <span className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">{hospital?.name || 'Hospital'}</span>
                        </h1>
                        <p className="text-slate-500 dark:text-gray-400 mt-2">Manage inventory, emergencies, and campaigns.</p>
                    </div>
                    <div className="hidden md:block">
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full border border-green-500/20">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">System Operational</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Critical Alerts Row */}
            {lowStockAlerts.length > 0 && (
                <div className="mb-10">
                    <GlassCard className="p-6 border-l-4 border-l-red-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-500/20 rounded-full text-red-500">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Low Stock Alert: {lowStockAlerts.map(a => a.type).join(', ')}</h3>
                                    <p className="text-sm text-slate-500 dark:text-gray-400">Critical levels detected. Recommended action: Initiate targeted campaign.</p>
                                </div>
                            </div>
                            <GlowButton variant="danger" size="sm">
                                Broadcast Alert
                            </GlowButton>
                        </div>
                    </GlassCard>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <div className="lg:col-span-1">
                    <ScrollReveal direction="left">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Operations</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {quickActions.map((action) => (
                                <Link key={action.label} href={action.href}>
                                    <GlassCard className={`p-4 bg-gradient-to-br ${action.color} text-center cursor-pointer hover:scale-[1.02] transition-transform`}>
                                        <span className="text-2xl block mb-2">{action.icon}</span>
                                        <p className="text-xs text-slate-600 dark:text-gray-300 font-medium">{action.label}</p>
                                    </GlassCard>
                                </Link>
                            ))}
                        </div>
                    </ScrollReveal>
                </div>

                {/* KPI Stats */}
                <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Units Collected Today', value: stats.collected, color: 'text-green-500' },
                            { label: 'Pending Appointments', value: stats.pending, color: 'text-blue-500' },
                            { label: 'Fulfilled Requests', value: stats.fulfilled, color: 'text-purple-500' },
                        ].map((stat) => (
                            <GlassCard key={stat.label} className="p-5 text-center">
                                <AnimatedCounter target={stat.value} className={`text-3xl font-bold ${stat.color}`} />
                                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{stat.label}</p>
                            </GlassCard>
                        ))}
                    </div>

                    <div className="mt-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Emergency Requests</h2>
                        <GlassCard className="overflow-hidden p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 dark:text-gray-400 uppercase bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                                    <tr>
                                        <th className="px-6 py-3">Patient Ref</th>
                                        <th className="px-6 py-3">Blood Type</th>
                                        <th className="px-6 py-3">Urgency</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentRequests.length > 0 ? recentRequests.map((req, i) => (
                                        <tr key={i} className="border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{req.ref}</td>
                                            <td className="px-6 py-4">{req.bloodType}</td>
                                            <td className="px-6 py-4 text-red-500 font-semibold">{req.urgency}</td>
                                            <td className="px-6 py-4 text-yellow-500">{req.status}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No recent requests</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </div>
    );
}
