'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import ScrollReveal from '@/components/animations/ScrollReveal';

interface LeaderboardDonor {
    _id: string;
    name: string;
    bloodType: string;
    xp: number;
    totalDonations: number;
}

function getTier(xp: number) {
    if (xp >= 5000) return 'Platinum';
    if (xp >= 2000) return 'Gold';
    if (xp >= 500) return 'Silver';
    return 'Bronze';
}

const RANK_BADGES = ['🏆', '🥈', '🥉'];

export default function LeaderboardPage() {
    const [donors, setDonors] = useState<LeaderboardDonor[]>([]);
    const [badges, setBadges] = useState<{ name: string; icon: string; description: string; holders: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [donorsRes, badgesRes] = await Promise.all([
                    fetch('/api/donors?sort=xp&limit=20'),
                    fetch('/api/badges'),
                ]);

                if (donorsRes.ok) {
                    const json = await donorsRes.json();
                    const list = (json.data || []).sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0));
                    setDonors(list.slice(0, 20));
                }

                if (badgesRes.ok) {
                    const json = await badgesRes.json();
                    setBadges((json.data || []).map((b: any) => ({
                        name: b.name,
                        icon: b.icon || '🏅',
                        description: b.description || '',
                        holders: 0,
                    })));
                }
            } catch (err) {
                console.error('Failed to load leaderboard:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    const top3 = donors.slice(0, 3);
    const rest = donors.slice(3);

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-6xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="text-center mb-12">
                        <span className="text-sm font-semibold text-yellow-500 dark:text-yellow-400 uppercase tracking-widest">Gamified Profiles</span>
                        <h1 className="mt-4 text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                            Donor <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Leaderboard</span>
                        </h1>
                        <p className="mt-4 text-slate-500 dark:text-gray-400 max-w-lg mx-auto">
                            Top donors ranked by XP. Earn points with every donation, emergency response, and campaign attendance.
                        </p>
                    </div>
                </ScrollReveal>

                {donors.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <ScrollReveal direction="left">
                                {/* Top 3 Podium */}
                                {top3.length >= 3 && (
                                    <div className="grid grid-cols-3 gap-4 mb-8">
                                        {top3.map((donor, i) => (
                                            <motion.div
                                                key={donor._id}
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.2, duration: 0.6 }}
                                                className={`${i === 0 ? 'order-2' : i === 1 ? 'order-1 mt-6' : 'order-3 mt-6'}`}
                                            >
                                                <GlassCard className={`p-6 text-center ${i === 0 ? 'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30' : ''}`}>
                                                    <span className="text-4xl block mb-2">{RANK_BADGES[i]}</span>
                                                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-red-500/30 to-red-600/10 flex items-center justify-center">
                                                        <span className="text-lg font-bold text-slate-900 dark:text-white">{donor.name?.[0] || '?'}</span>
                                                    </div>
                                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{donor.name}</h3>
                                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{donor.bloodType}</p>
                                                    <p className="text-lg font-bold text-yellow-500 dark:text-yellow-400 mt-2">{(donor.xp || 0).toLocaleString()} XP</p>
                                                    <p className="text-xs text-slate-400 dark:text-gray-500">{donor.totalDonations || 0} donations</p>
                                                </GlassCard>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}

                                {/* Rest of leaderboard */}
                                {rest.length > 0 && (
                                    <GlassCard className="overflow-hidden">
                                        <div className="divide-y divide-slate-200 dark:divide-white/5">
                                            {rest.map((donor, i) => {
                                                const rank = i + 4;
                                                const tier = getTier(donor.xp || 0);
                                                return (
                                                    <motion.div
                                                        key={donor._id}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: 0.6 + i * 0.1 }}
                                                        className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <span className="w-8 text-center text-sm font-bold text-slate-400 dark:text-gray-500">#{rank}</span>
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                                                                <span className="text-sm font-bold text-white dark:text-gray-300">{donor.name?.[0] || '?'}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-900 dark:text-white">{donor.name}</p>
                                                                <p className="text-xs text-slate-500 dark:text-gray-500">{donor.bloodType} • {donor.totalDonations || 0} donations</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{(donor.xp || 0).toLocaleString()} XP</p>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                                tier === 'Platinum' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                                                                tier === 'Gold' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                                                                tier === 'Silver' ? 'bg-slate-400/10 text-slate-600 dark:text-gray-300' :
                                                                'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                                            }`}>
                                                                {tier}
                                                            </span>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </GlassCard>
                                )}
                            </ScrollReveal>
                        </div>

                        {/* Badges sidebar */}
                        <div className="lg:col-span-1">
                            <ScrollReveal direction="right">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">🏅 Badges & Achievements</h2>
                                {badges.length > 0 ? (
                                    <div className="space-y-3">
                                        {badges.map((badge) => (
                                            <GlassCard key={badge.name} className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{badge.icon}</span>
                                                    <div className="flex-1">
                                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{badge.name}</h4>
                                                        <p className="text-xs text-slate-500 dark:text-gray-400">{badge.description}</p>
                                                    </div>
                                                </div>
                                            </GlassCard>
                                        ))}
                                    </div>
                                ) : (
                                    <GlassCard className="p-6 text-center">
                                        <span className="text-4xl block mb-2">🏅</span>
                                        <p className="text-sm text-slate-500 dark:text-gray-400">No badges configured yet.</p>
                                    </GlassCard>
                                )}
                            </ScrollReveal>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <span className="text-6xl block mb-4">🏆</span>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Donors Yet</h3>
                        <p className="text-slate-500 dark:text-gray-400">Be the first to register and start earning XP!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
