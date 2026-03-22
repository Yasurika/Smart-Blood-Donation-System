'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';

const SRI_LANKA_DISTRICTS = ['Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Mullaitivu','Batticaloa','Ampara','Trincomalee','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle'];

const FACILITY_OPTIONS = ['Blood Bank', 'Emergency Unit', 'ICU', 'Surgery', 'Oncology', 'Dialysis', 'Maternity', 'Pediatrics', 'Laboratory', 'Radiology'];

export default function HospitalRegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        address: '',
        district: '',
        contactPerson: '',
        facilities: [] as string[],
        latitude: '' as string | number,
        longitude: '' as string | number,
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [detectingLocation, setDetectingLocation] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const toggleFacility = (facility: string) => {
        setFormData(prev => ({
            ...prev,
            facilities: prev.facilities.includes(facility)
                ? prev.facilities.filter(f => f !== facility)
                : [...prev.facilities, facility],
        }));
    };

    const detectLocation = async () => {
        setDetectingLocation(true);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            setFormData(prev => ({
                ...prev,
                latitude: parseFloat(position.coords.latitude.toFixed(6)),
                longitude: parseFloat(position.coords.longitude.toFixed(6)),
            }));
        } catch {
            setError('Could not detect location. Please enter coordinates manually.');
        } finally {
            setDetectingLocation(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Validate required fields
            if (!formData.name?.trim()) {
                setError('Hospital name is required');
                setIsLoading(false);
                return;
            }
            if (!formData.email?.trim()) {
                setError('Email address is required');
                setIsLoading(false);
                return;
            }
            if (!formData.password) {
                setError('Password is required');
                setIsLoading(false);
                return;
            }
            if (!formData.address?.trim()) {
                setError('Address is required');
                setIsLoading(false);
                return;
            }
            if (!formData.phone?.trim()) {
                setError('Phone number is required');
                setIsLoading(false);
                return;
            }
            if (!formData.contactPerson?.trim()) {
                setError('Contact person name is required');
                setIsLoading(false);
                return;
            }

            // Prepare clean data for API (only include coordinates if both are provided)
            const submitData: any = {
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
                address: formData.address.trim(),
                phone: formData.phone.trim(),
                contactPerson: formData.contactPerson.trim(),
                facilities: formData.facilities,
            };

            // Only include district if selected
            if (formData.district) {
                submitData.district = formData.district;
            }

            // Only include coordinates if both latitude and longitude are provided
            if (formData.latitude && formData.longitude) {
                const lat = parseFloat(String(formData.latitude));
                const lng = parseFloat(String(formData.longitude));
                if (!isNaN(lat) && !isNaN(lng)) {
                    submitData.latitude = lat;
                    submitData.longitude = lng;
                }
            }

            const res = await fetch('/api/auth/register-hospital', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData),
            });

            const data = await res.json();

            if (!res.ok) {
                // Format error messages for display
                if (data.errors && Array.isArray(data.errors)) {
                    const errorMessages = data.errors.map((e: any) => e.message).join(', ');
                    throw new Error(errorMessages);
                }
                throw new Error(data.error || data.message || 'Registration failed');
            }

            router.push('/login?registered=true');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 pt-24 pb-12">
            <GlassCard className="w-full max-w-3xl p-8 backdrop-blur-3xl bg-black/40 border-white/10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent mb-2">
                        Register Your Hospital
                    </h1>
                    <p className="text-gray-400 text-sm">Join the SmartBlood network to manage blood inventory and emergencies</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Hospital Name</label>
                            <input
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                                placeholder="National Hospital Colombo"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Official Email</label>
                            <input
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                                placeholder="admin@hospital.lk"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Phone Number</label>
                            <input
                                name="phone"
                                required
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                                placeholder="+94 11 XXX XXXX"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Contact Person</label>
                            <input
                                name="contactPerson"
                                required
                                value={formData.contactPerson}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                                placeholder="Dr. John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">District</label>
                            <select
                                name="district"
                                value={formData.district}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white appearance-none"
                            >
                                <option value="" className="bg-slate-900">Select District</option>
                                {SRI_LANKA_DISTRICTS.map(d => (
                                    <option key={d} value={d} className="bg-slate-900">{d}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Address</label>
                        <input
                            name="address"
                            required
                            value={formData.address}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                            placeholder="Regent Street, Colombo 07"
                        />
                    </div>

                    {/* Location Coordinates */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-300">Hospital Location (GPS Coordinates)</label>
                            <button
                                type="button"
                                onClick={detectLocation}
                                disabled={detectingLocation}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                            >
                                {detectingLocation ? '📍 Detecting...' : '📍 Detect Location'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <input
                                    name="latitude"
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                                    placeholder="Latitude (e.g. 6.9271)"
                                />
                            </div>
                            <div>
                                <input
                                    name="longitude"
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                                    placeholder="Longitude (e.g. 79.8612)"
                                />
                            </div>
                        </div>
                        {formData.latitude && formData.longitude && (
                            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                                <p className="text-xs text-green-400">✓ Location set: {String(formData.latitude)}, {String(formData.longitude)}</p>
                            </div>
                        )}
                        <p className="text-xs text-gray-500">Used for nearby donor matching and map features. Click &quot;Detect Location&quot; or enter manually.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Facilities Available</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {FACILITY_OPTIONS.map(facility => (
                                <button
                                    key={facility}
                                    type="button"
                                    onClick={() => toggleFacility(facility)}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                                        formData.facilities.includes(facility)
                                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                                >
                                    {facility}
                                </button>
                            ))}
                        </div>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <GlowButton
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 text-base"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Registering Hospital...
                            </span>
                        ) : (
                            'Register Hospital'
                        )}
                    </GlowButton>
                </form>

                <div className="mt-6 text-center space-y-2">
                    <div className="text-sm text-gray-400">
                        Already registered?{' '}
                        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            Sign In here
                        </Link>
                    </div>
                    <div className="text-sm text-gray-400">
                        Are you a donor?{' '}
                        <Link href="/register" className="text-red-400 hover:text-red-300 font-medium transition-colors">
                            Donor Registration
                        </Link>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
