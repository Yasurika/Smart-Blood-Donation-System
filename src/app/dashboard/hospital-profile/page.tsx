'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import LocationPicker from '@/components/ui/LocationPicker';

interface HospitalProfile {
    _id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    district: string;
    location?: { type: string; coordinates: [number, number] };
    bloodStocks?: Record<string, number>;
    facilities?: string[];
}

export default function HospitalProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [profile, setProfile] = useState<HospitalProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ phone: '', address: '', district: '' });
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Redirect if not hospital or admin
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated' && session?.user?.role !== 'hospital' && session?.user?.role !== 'admin') {
            router.push('/dashboard/profile');
        }
    }, [status, session, router]);

    // Fetch hospital profile
    useEffect(() => {
        async function fetchProfile() {
            if (!session?.user?.id) return;
            try {
                // For admins, fetch from User collection; for hospital staff, fetch from Hospital
                const endpoint = session.user.role === 'admin' 
                    ? `/api/donors/${session.user.id}` // Admins use the user endpoint
                    : `/api/hospitals/${session.user.id}`;
                
                const res = await fetch(endpoint);
                if (res.ok) {
                    const data = await res.json();
                    const hospital = data.data || data;
                    setProfile(hospital);
                    setEditForm({
                        phone: hospital.phone || '',
                        address: hospital.address || '',
                        district: hospital.district || '',
                    });
                } else {
                    console.error('Failed to fetch profile:', res.status);
                }
            } catch (err) {
                console.error('Failed to fetch hospital profile:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [session?.user?.id, session?.user?.role]);

    const handleEditProfile = async () => {
        if (!profile?._id) return;
        try {
            setLoading(true);
            setMessage('');
            const endpoint = session?.user?.role === 'admin' 
                ? `/api/donors/${profile._id}` 
                : `/api/hospitals/${profile._id}`;
            
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });

            if (!res.ok) throw new Error('Failed to update profile');
            const data = await res.json();
            const updated = data.data || data;
            setProfile(updated);
            setEditing(false);
            setMessage('✓ Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage('✗ Failed to update profile: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleLocationSelect = async (latitude: number, longitude: number) => {
        if (!profile?._id) return;
        setLocationLoading(true);
        try {
            const res = await fetch('/api/locations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude, longitude }),
            });

            if (!res.ok) throw new Error('Failed to save location');
            
            // Refresh profile with new location
            const refreshRes = await fetch(`/api/hospitals/${profile._id}`);
            if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                const updated = refreshData.data || refreshData;
                setProfile(updated);
            }
            setShowLocationPicker(false);
            setMessage('✓ Location saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage('✗ Failed to save location: ' + (err as Error).message);
        } finally {
            setLocationLoading(false);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!session?.user || !profile) {
        return null;
    }

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <ScrollReveal direction="up">
                    <div className="mb-8">
                        <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">
                            {session?.user?.role === 'admin' ? 'Admin Profile' : 'Hospital Profile'}
                        </span>
                        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            {profile.name}
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-gray-400">{profile.district}</p>
                    </div>
                </ScrollReveal>

                {/* Messages */}
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mb-6 p-4 rounded-lg ${
                            message.startsWith('✓')
                                ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30'
                                : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
                        }`}
                    >
                        <p className={message.startsWith('✓') ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'}>
                            {message}
                        </p>
                    </motion.div>
                )}

                {/* Hospital Info Card */}
                <ScrollReveal direction="up">
                    <GlassCard className="p-8 mb-8">
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Information</h2>
                            {!editing ? (
                                <GlowButton
                                    size="sm"
                                    onClick={() => setEditing(true)}
                                >
                                    ✏️ Edit
                                </GlowButton>
                            ) : (
                                <div className="flex gap-2">
                                    <GlowButton
                                        size="sm"
                                        onClick={handleEditProfile}
                                        disabled={loading}
                                    >
                                        {loading ? '⏳ Saving...' : '✓ Save'}
                                    </GlowButton>
                                    <GlowButton
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditing(false)}
                                    >
                                        ✕ Cancel
                                    </GlowButton>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Name */}
                            <div>
                                <label className="text-sm font-semibold text-slate-900 dark:text-white">Hospital Name</label>
                                <p className={`mt-2 p-3 rounded-lg ${editing ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-gray-300' : 'text-slate-600 dark:text-gray-400'}`}>
                                    {profile.name}
                                </p>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="text-sm font-semibold text-slate-900 dark:text-white">Email</label>
                                <p className={`mt-2 p-3 rounded-lg ${editing ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-gray-300' : 'text-slate-600 dark:text-gray-400'}`}>
                                    {profile.email}
                                </p>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="text-sm font-semibold text-slate-900 dark:text-white">Phone</label>
                                {editing ? (
                                    <input
                                        type="text"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="mt-2 w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                    />
                                ) : (
                                    <p className="mt-2 p-3 rounded-lg text-slate-600 dark:text-gray-400">
                                        {profile.phone || 'Not set'}
                                    </p>
                                )}
                            </div>

                            {/* District */}
                            <div>
                                <label className="text-sm font-semibold text-slate-900 dark:text-white">District</label>
                                {editing ? (
                                    <input
                                        type="text"
                                        value={editForm.district}
                                        onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                                        className="mt-2 w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                    />
                                ) : (
                                    <p className="mt-2 p-3 rounded-lg text-slate-600 dark:text-gray-400">
                                        {profile.district || 'Not set'}
                                    </p>
                                )}
                            </div>

                            {/* Address */}
                            <div className="md:col-span-2">
                                <label className="text-sm font-semibold text-slate-900 dark:text-white">Address</label>
                                {editing ? (
                                    <textarea
                                        value={editForm.address}
                                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                        className="mt-2 w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                        rows={3}
                                    />
                                ) : (
                                    <p className="mt-2 p-3 rounded-lg text-slate-600 dark:text-gray-400">
                                        {profile.address || 'Not set'}
                                    </p>
                                )}
                            </div>
                        </div>

                {/* GPS Location Section */}
                <ScrollReveal direction="up">
                    <div>
                        {!showLocationPicker ? (
                            profile.location ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-8"
                                >
                                    <GlassCard className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border-2 border-green-200 dark:border-green-500/30">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-3xl">✓</span>
                                                <div>
                                                    <h3 className="text-lg font-bold text-green-900 dark:text-green-200">GPS Location</h3>
                                                    <p className="text-sm text-green-800 dark:text-green-300">Active</p>
                                                </div>
                                            </div>
                                            <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                                                Active
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg">
                                                <p className="text-xs text-slate-500 dark:text-gray-400">Latitude</p>
                                                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                                                    {profile.location.coordinates[1].toFixed(6)}
                                                </p>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg">
                                                <p className="text-xs text-slate-500 dark:text-gray-400">Longitude</p>
                                                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                                                    {profile.location.coordinates[0].toFixed(6)}
                                                </p>
                                            </div>
                                        </div>
                                        <GlowButton
                                            onClick={() => setShowLocationPicker(true)}
                                            className="w-full"
                                        >
                                            🗺️ Update Location on Map
                                        </GlowButton>
                                    </GlassCard>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-8"
                                >
                                    <GlassCard className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600">
                                        <div className="text-center">
                                            <span className="text-5xl block mb-3">📍</span>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                                No location set yet
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
                                                Help others find you by marking your hospital location on the map
                                            </p>
                                            <GlowButton
                                                onClick={() => setShowLocationPicker(true)}
                                                className="w-full"
                                            >
                                                🗺️ Select Location on Map
                                            </GlowButton>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            )
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-8"
                            >
                                <GlassCard className="p-6 border-2 border-blue-500/50">
                                    <div className="mb-4">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                                            Click on the map to select your hospital location
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
                                        title="Select Hospital Location"
                                        description="Interact with the map below to set your GPS location"
                                    />
                                </GlassCard>

                                <div className="flex gap-2 mt-4">
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
                    </GlassCard>
                </ScrollReveal>
            </div>
        </div>
    );
}
