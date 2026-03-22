'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import LocationPicker from '@/components/ui/LocationPicker';
import GlassCard from '@/components/ui/GlassCard';
import { motion } from 'framer-motion';
import ScrollReveal from '@/components/animations/ScrollReveal';

export default function SetLocationPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const currentLocation = session?.user?.location
        ? { lat: session.user.location.coordinates[1], lng: session.user.location.coordinates[0] }
        : undefined;

    if (status === 'loading') {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!session?.user) {
        router.push('/login');
        return null;
    }

    const handleLocationSelect = async (latitude: number, longitude: number) => {
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const res = await fetch('/api/locations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude, longitude }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save location');
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/dashboard');
            }, 2000);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-4xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="mb-8">
                        <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Location Setup</span>
                        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Mark Your <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Location</span>
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-gray-400">
                            Help us find you on the blood donation map. You can update this anytime.
                        </p>
                    </div>
                </ScrollReveal>

                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg flex items-center gap-3"
                    >
                        <span className="text-2xl">✓</span>
                        <div>
                            <p className="font-semibold text-green-900 dark:text-green-200">Location saved successfully!</p>
                            <p className="text-sm text-green-800 dark:text-green-300">Redirecting to dashboard...</p>
                        </div>
                    </motion.div>
                )}

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg flex items-center gap-3"
                    >
                        <span className="text-2xl">!</span>
                        <div>
                            <p className="font-semibold text-red-900 dark:text-red-200">{error}</p>
                            <p className="text-sm text-red-800 dark:text-red-300">Please try again</p>
                        </div>
                    </motion.div>
                )}

                <ScrollReveal direction="up">
                    <GlassCard className="p-8">
                        <LocationPicker
                            onLocationSelect={handleLocationSelect}
                            currentLocation={currentLocation}
                            title={`${session.user.name}'s Location`}
                            description="Click on the map to mark your location, drag the marker to adjust, or use your current location"
                        />

                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-6 flex items-center justify-center gap-3 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg"
                            >
                                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                    Saving your location...
                                </span>
                            </motion.div>
                        )}
                    </GlassCard>
                </ScrollReveal>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                    <GlassCard className="p-6">
                        <div className="text-3xl mb-3">📍</div>
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Visible on Map</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400">
                            Other donors and hospitals can find you on the blood donation map
                        </p>
                    </GlassCard>

                    <GlassCard className="p-6">
                        <div className="text-3xl mb-3">🔄</div>
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Update Anytime</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400">
                            Visit your donor profile to update your location whenever needed
                        </p>
                    </GlassCard>
                </motion.div>
            </div>
        </div>
    );
}
