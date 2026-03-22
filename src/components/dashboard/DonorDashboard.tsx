'use client';

import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import AnimatedCounter from '@/components/animations/AnimatedCounter';
import ScrollReveal from '@/components/animations/ScrollReveal';
import Link from 'next/link';
import type { DonorDashboardData } from '@/lib/data/dashboard';

interface DonorDashboardProps {
    data: DonorDashboardData;
}

const quickActions = [
    { label: 'Book Appointment', href: '/dashboard/appointments', icon: '📅', color: 'from-blue-500/20' },
    { label: 'Emergency Requests', href: '/dashboard/requests', icon: '🚨', color: 'from-red-500/20' },
    { label: 'My Profile', href: '/dashboard/profile', icon: '👤', color: 'from-purple-500/20' },
    { label: 'Leaderboard', href: '/dashboard/leaderboard', icon: '🏆', color: 'from-yellow-500/20' },
    { label: 'Campaigns', href: '/campaigns', icon: '📢', color: 'from-orange-500/20' },
];

export default function DonorDashboard({ data }: DonorDashboardProps) {
    const { user, stats, recentActivity } = data;

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-10"
            >
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                    Welcome back, <span className="bg-gradient-to-r from-red-500 to-amber-500 bg-clip-text text-transparent">{user?.name || 'Donor'}</span> 🩸
                </h1>
                <p className="text-slate-500 dark:text-gray-400 mt-2">Here&apos;s your blood donation impact.</p>
            </motion.div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {[
                    { label: 'Total Donations', value: stats.donations, icon: '🩸', color: 'from-red-500' },
                    { label: 'Lives Saved', value: stats.livesSaved, icon: '❤️', color: 'from-pink-500' },
                    { label: 'XP Points', value: stats.xp, icon: '⭐', color: 'from-yellow-500' },
                    { label: 'Badges Earned', value: stats.badges, icon: '🏅', color: 'from-purple-500' },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                    >
                        <GlassCard className="p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">{stat.label}</p>
                                    <AnimatedCounter
                                        target={stat.value}
                                        className={`text-2xl font-bold bg-gradient-to-r ${stat.color} to-red-400 bg-clip-text text-transparent`}
                                    />
                                </div>
                                <span className="text-2xl">{stat.icon}</span>
                            </div>
                        </GlassCard>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <div className="lg:col-span-1">
                    <ScrollReveal direction="left">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
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

                {/* Recent Activity */}
                <div className="lg:col-span-2">
                    <ScrollReveal direction="right">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Activity</h2>
                        <GlassCard className="p-5">
                            <div className="space-y-4">
                                {recentActivity.length > 0 ? recentActivity.map((item, i) => (
                                    <div key={item.id || i} className="flex items-start gap-3">
                                        <div className={`w-2 h-2 rounded-full mt-2 ${item.type === 'success' ? 'bg-green-400' :
                                            item.type === 'achievement' ? 'bg-yellow-400' : 'bg-blue-400'
                                            }`} />
                                        <div>
                                            <p className="text-sm text-slate-600 dark:text-gray-300">{item.action}</p>
                                            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{item.time}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center text-sm text-gray-500 py-4">No recent activity</div>
                                )}
                            </div>
                        </GlassCard>
                    </ScrollReveal>
                </div>
            </div>
        </div>
    );
}
