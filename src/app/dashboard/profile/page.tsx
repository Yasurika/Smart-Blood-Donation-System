'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import AnimatedCounter from '@/components/animations/AnimatedCounter';
import LocationPicker from '@/components/ui/LocationPicker';
import { useSession } from 'next-auth/react';

interface ProfileData {
    name: string;
    email: string;
    bloodType: string;
    phone: string;
    address: string;
    weight: number;
    xp: number;
    totalDonations: number;
    memberSince: string;
    lastDonation: string | null;
    nextEligible: string | null;
    badges: { _id: string; name: string; icon: string; description: string }[];
    location?: { type: string; coordinates: [number, number] };
}

interface DonationRecord {
    _id: string;
    hospitalName: string;
    date: string;
    status: string;
}

function getTier(xp: number) {
    if (xp >= 5000) return 'Platinum';
    if (xp >= 2000) return 'Gold';
    if (xp >= 500) return 'Silver';
    return 'Bronze';
}

function getNextTier(xp: number) {
    if (xp >= 5000) return { next: 'Legend', remaining: 10000 - xp, progress: ((xp - 5000) / 5000) * 100 };
    if (xp >= 2000) return { next: 'Platinum', remaining: 5000 - xp, progress: ((xp - 2000) / 3000) * 100 };
    if (xp >= 500) return { next: 'Gold', remaining: 2000 - xp, progress: ((xp - 500) / 1500) * 100 };
    return { next: 'Silver', remaining: 500 - xp, progress: (xp / 500) * 100 };
}

export default function ProfilePage() {
    const { data: session } = useSession();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [donations, setDonations] = useState<DonationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ phone: '', address: '', weight: '' });
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);

    useEffect(() => {
        async function fetchProfile() {
            try {
                const [donorRes, apptRes, badgesRes] = await Promise.all([
                    fetch(`/api/donors/${session?.user?.id}`),
                    fetch(`/api/appointments?status=Completed&limit=10`),
                    fetch(`/api/badges`),
                ]);

                if (donorRes.ok) {
                    const donorData = await donorRes.json();
                    const user = donorData.data || donorData;
                    const allBadges = badgesRes.ok ? (await badgesRes.json()).data || [] : [];
                    const userBadgeIds = (user.badges || []).map((b: any) => typeof b === 'string' ? b : b._id);

                    setProfile({
                        name: user.name || 'Donor',
                        email: user.email || '',
                        bloodType: user.bloodType || 'Unknown',
                        phone: user.phone || '',
                        address: user.address || '',
                        weight: user.weight || 0,
                        xp: user.xp || 0,
                        totalDonations: user.totalDonations || 0,
                        memberSince: new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                        lastDonation: user.lastDonationDate ? new Date(user.lastDonationDate).toLocaleDateString() : null,
                        nextEligible: user.lastDonationDate
                            ? new Date(new Date(user.lastDonationDate).getTime() + 56 * 24 * 60 * 60 * 1000).toLocaleDateString()
                            : null,
                        badges: allBadges.map((b: any) => ({
                            ...b,
                            earned: userBadgeIds.includes(b._id),
                        })),
                        location: user.location,
                    });
                    setEditForm({ phone: user.phone || '', address: user.address || '', weight: String(user.weight || '') });
                }

                if (apptRes.ok) {
                    const apptData = await apptRes.json();
                    const list = apptData.data || apptData;
                    setDonations(Array.isArray(list) ? list.map((a: any) => ({
                        _id: a._id,
                        hospitalName: a.hospitalId?.name || 'Hospital',
                        date: new Date(a.date).toLocaleDateString(),
                        status: a.status,
                    })) : []);
                }
            } catch (err) {
                console.error('Failed to load profile:', err);
            } finally {
                setLoading(false);
            }
        }

        if (session?.user?.id) fetchProfile();
    }, [session?.user?.id]);

    const handleSaveProfile = async () => {
        try {
            const res = await fetch(`/api/donors/${session?.user?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: editForm.phone,
                    address: editForm.address,
                    weight: Number(editForm.weight),
                }),
            });
            if (res.ok) {
                setProfile(prev => prev ? {
                    ...prev,
                    phone: editForm.phone,
                    address: editForm.address,
                    weight: Number(editForm.weight),
                } : prev);
                setEditing(false);
            }
        } catch (err) {
            console.error('Failed to update profile:', err);
        }
    };

    const handleLocationSelect = async (lat: number, lng: number) => {
        try {
            setLocationLoading(true);
            const res = await fetch('/api/locations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: lat, longitude: lng }),
            });
            if (res.ok) {
                const data = await res.json();
                setProfile(prev => prev ? {
                    ...prev,
                    location: data.location,
                } : prev);
                setShowLocationPicker(false);
            }
        } catch (err) {
            console.error('Failed to save location:', err);
        } finally {
            setLocationLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center text-slate-500 dark:text-gray-400">
                Unable to load profile. Please try again later.
            </div>
        );
    }

    const tier = getTier(profile.xp);
    const tierInfo = getNextTier(profile.xp);
    const livesSaved = profile.totalDonations * 3;

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-6xl mx-auto">
                {/* Profile Header */}
                <ScrollReveal direction="up">
                    <GlassCard className="p-8 mb-8" hover={false}>
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="relative">
                                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-2xl shadow-red-500/30">
                                    <span className="text-4xl font-bold text-white">{profile.name[0]}</span>
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-yellow-500/20 border-2 border-yellow-500/50 flex items-center justify-center">
                                    <span className="text-sm">🏅</span>
                                </div>
                            </div>

                            <div className="text-center md:text-left flex-1">
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{profile.name}</h1>
                                <p className="text-slate-500 dark:text-gray-400 text-sm">{profile.email}</p>
                                <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                                    <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-500 dark:text-red-400 text-xs font-medium">
                                        🩸 {profile.bloodType}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
                                        ⭐ {tier} Tier
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-medium">
                                        Member since {profile.memberSince}
                                    </span>
                                </div>
                            </div>

                            <div className="text-center">
                                <AnimatedCounter target={profile.xp} className="text-4xl font-bold text-yellow-400" />
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Total XP</p>
                                <div className="mt-3 w-40">
                                    <div className="flex justify-between text-xs text-slate-400 dark:text-gray-500 mb-1">
                                        <span>{tier}</span>
                                        <span>{tierInfo.next}</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, tierInfo.progress)}%` }}
                                            transition={{ duration: 1.5, delay: 0.5 }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{tierInfo.remaining} XP to {tierInfo.next}</p>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </ScrollReveal>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Donations', value: profile.totalDonations, icon: '🩸' },
                        { label: 'Lives Saved', value: livesSaved, icon: '❤️' },
                        { label: 'Badges Earned', value: profile.badges.filter((b: any) => b.earned).length, icon: '🏅' },
                        { label: 'XP Points', value: profile.xp, icon: '⭐' },
                    ].map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                            <GlassCard className="p-5 text-center">
                                <span className="text-2xl block mb-2">{stat.icon}</span>
                                <AnimatedCounter target={stat.value} className="text-2xl font-bold text-slate-900 dark:text-white" />
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{stat.label}</p>
                            </GlassCard>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Badges */}
                    <ScrollReveal direction="left">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">🏅 Your Badges</h2>
                        {profile.badges.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {profile.badges.map((badge: any) => (
                                    <GlassCard key={badge._id} className={`p-4 ${!badge.earned ? 'opacity-40 grayscale' : ''}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{badge.icon || '🏅'}</span>
                                            <div>
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{badge.name}</h4>
                                                <p className="text-xs text-slate-500 dark:text-gray-400">{badge.description}</p>
                                            </div>
                                        </div>
                                        {!badge.earned && (
                                            <span className="mt-2 block text-xs text-slate-400 dark:text-gray-500">🔒 Locked</span>
                                        )}
                                    </GlassCard>
                                ))}
                            </div>
                        ) : (
                            <GlassCard className="p-8 text-center">
                                <span className="text-4xl block mb-3">🏅</span>
                                <p className="text-sm text-slate-500 dark:text-gray-400">Start donating to earn badges!</p>
                            </GlassCard>
                        )}
                    </ScrollReveal>

                    {/* Donation History + Edit Profile */}
                    <ScrollReveal direction="right">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">📋 Donation History</h2>
                        <GlassCard className="p-0 overflow-hidden">
                            <div className="divide-y divide-slate-200 dark:divide-white/5">
                                {donations.length > 0 ? donations.map((item) => (
                                    <div key={item._id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-slate-900 dark:text-white">{item.hospitalName}</p>
                                                <p className="text-xs text-slate-500 dark:text-gray-500">{item.date}</p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                item.status === 'Completed' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                            }`}>{item.status}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="px-6 py-8 text-center text-slate-500 dark:text-gray-500 text-sm">
                                        No donation history yet. Book your first appointment!
                                    </div>
                                )}
                            </div>
                        </GlassCard>

                        {profile.nextEligible && (
                            <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <p className="text-sm text-blue-600 dark:text-blue-300">
                                    📅 Next eligible donation: <strong>{profile.nextEligible}</strong>
                                </p>
                            </div>
                        )}

                        {/* Edit Profile Section */}
                        {editing ? (
                            <div className="mt-4">
                                <GlassCard className="p-6">
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Edit Profile</h3>
                                    <div className="space-y-3">
                                        <input type="text" placeholder="Phone" value={editForm.phone}
                                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:border-red-500 outline-none" />
                                        <input type="text" placeholder="Address" value={editForm.address}
                                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:border-red-500 outline-none" />
                                        <input type="number" placeholder="Weight (kg)" value={editForm.weight}
                                            onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:border-red-500 outline-none" />
                                        <div className="flex gap-2">
                                            <GlowButton size="sm" onClick={handleSaveProfile}>Save</GlowButton>
                                            <GlowButton variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</GlowButton>
                                        </div>
                                    </div>
                                </GlassCard>
                            </div>
                        ) : (
                            <div className="mt-4">
                                <GlowButton variant="outline" className="w-full" onClick={() => setEditing(true)}>
                                    Edit Profile
                                </GlowButton>
                            </div>
                        )}

                        {/* GPS Location Section */}
                        <div className="mt-8">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">📍 GPS Location</h2>
                            
                            {!showLocationPicker ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-3"
                                >
                                    {profile?.location ? (
                                        <motion.div className="relative overflow-hidden rounded-xl">
                                            <GlassCard className="p-6 border-2 border-green-500/50 bg-green-500/5">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div>
                                                        <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
                                                            ✓ Location Set
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Your current GPS coordinates</p>
                                                    </div>
                                                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-semibold">
                                                        Active
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 mt-4">
                                                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/5">
                                                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Latitude</p>
                                                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                                                            {profile.location.coordinates[1].toFixed(6)}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/5">
                                                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Longitude</p>
                                                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                                                            {profile.location.coordinates[0].toFixed(6)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </GlassCard>
                                        </motion.div>
                                    ) : (
                                        <motion.div className="relative overflow-hidden rounded-xl">
                                            <GlassCard className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600">
                                                <div className="text-center py-4">
                                                    <p className="text-3xl mb-2">📍</p>
                                                    <p className="text-sm font-semibold text-slate-600 dark:text-gray-300">No location set yet</p>
                                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Click the button below to select your location on the map</p>
                                                </div>
                                            </GlassCard>
                                        </motion.div>
                                    )}
                                    
                                    <GlowButton 
                                        className="w-full py-3 text-base font-semibold"
                                        onClick={() => setShowLocationPicker(true)}
                                    >
                                        🗺️ {profile?.location ? 'Update Location on Map' : 'Select Location on Map'}
                                    </GlowButton>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    <GlassCard className="p-6 border-2 border-blue-500/50">
                                        <div className="mb-4">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                                                Click on the map to select your location
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-gray-400">
                                                • Click anywhere to place a marker
                                                <br />• Drag the marker to adjust position
                                                <br />• Use "Use Current Location" to auto-detect
                                            </p>
                                        </div>
                                        
                                        <LocationPicker
                                            onLocationSelect={handleLocationSelect}
                                            currentLocation={profile?.location ? { lat: profile.location.coordinates[1], lng: profile.location.coordinates[0] } : undefined}
                                            title="Select Your Location"
                                            description="Interact with the map below to set your GPS location"
                                        />
                                    </GlassCard>

                                    <div className="flex gap-2">
                                        <GlowButton 
                                            size="sm" 
                                            disabled={locationLoading}
                                            className="flex-1"
                                        >
                                            {locationLoading ? '⏳ Saving...' : '✓ Location Selected'}
                                        </GlowButton>
                                        <GlowButton 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setShowLocationPicker(false)}
                                            className="flex-1"
                                        >
                                            ✕ Close
                                        </GlowButton>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </ScrollReveal>
                </div>
            </div>
        </div>
    );
}
