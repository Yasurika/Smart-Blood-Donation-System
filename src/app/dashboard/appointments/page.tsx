'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import { useSession } from 'next-auth/react';

interface Hospital {
    _id: string;
    name: string;
    address: string;
    district?: string;
    phone?: string;
    distance?: number;
    location?: { coordinates: [number, number] };
    operatingHours?: { open: string; close: string };
}

interface Appointment {
    _id: string;
    hospitalId: { _id: string; name: string; address?: string } | null;
    date: string;
    timeSlot: string;
    status: string;
}

const timeSlots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

interface Campaign {
    _id: string;
    title: string;
    description: string;
    location: { address: string; coordinates?: [number, number] };
    date: string;
    endDate: string;
    maxCapacity: number;
    rsvpList: string[];
    bloodTypesNeeded?: string[];
}

export default function AppointmentsPage() {
    const { data: session } = useSession();
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [nearbyHospitals, setNearbyHospitals] = useState<Hospital[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [booked, setBooked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [error, setError] = useState('');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [sortByDistance, setSortByDistance] = useState(false);
    const [bookedSlots, setBookedSlots] = useState<string[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                const [hospRes, apptRes, campRes] = await Promise.all([
                    fetch('/api/hospitals?limit=100'),
                    fetch('/api/appointments'),
                    fetch('/api/campaigns?upcoming=true&limit=10'),
                ]);

                if (hospRes.ok) {
                    const hospData = await hospRes.json();
                    setHospitals(hospData.data || []);
                }

                if (apptRes.ok) {
                    const apptData = await apptRes.json();
                    setAppointments(apptData.data || []);
                }

                if (campRes.ok) {
                    const campData = await campRes.json();
                    setCampaigns(campData.data || []);
                }
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // Fetch booked slots whenever hospital or date changes
    useEffect(() => {
        if (!selectedHospital || !selectedDate) {
            setBookedSlots([]);
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/appointments?bookedSlots=true&hospitalId=${selectedHospital}&date=${selectedDate}`);
                if (res.ok) {
                    const data = await res.json();
                    setBookedSlots(data.data?.bookedSlots || []);
                    // If currently selected time is now booked, deselect it
                    if (data.data?.bookedSlots?.includes(selectedTime)) {
                        setSelectedTime('');
                    }
                }
            } catch { /* ignore */ }
        })();
    }, [selectedHospital, selectedDate, selectedTime]);

    const findNearestHospitals = useCallback(async () => {
        setLocationLoading(true);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });

            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });

            const res = await fetch(`/api/hospitals?lat=${latitude}&lng=${longitude}&maxDistance=100000&limit=20`);
            if (res.ok) {
                const data = await res.json();
                setNearbyHospitals(data.data || []);
                setSortByDistance(true);
            }
        } catch {
            setError('Could not detect your location. Please select a hospital manually.');
        } finally {
            setLocationLoading(false);
        }
    }, []);

    const handleBook = async () => {
        if (!selectedHospital || !selectedDate || !selectedTime) return;
        setBooking(true);
        setError('');

        try {
            const res = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hospitalId: selectedHospital,
                    date: selectedDate,
                    timeSlot: selectedTime,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setBooked(true);
                const refreshRes = await fetch('/api/appointments');
                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    setAppointments(refreshData.data || []);
                }
            } else {
                setError(data.error || 'Failed to book appointment.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setBooking(false);
        }
    };

    const handleCancel = async (id: string) => {
        try {
            const res = await fetch(`/api/appointments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Cancelled' }),
            });

            if (res.ok) {
                setAppointments(prev => prev.map(a => a._id === id ? { ...a, status: 'Cancelled' } : a));
            }
        } catch (err) {
            console.error('Cancel failed:', err);
        }
    };

    const openDirections = (hospital: Hospital) => {
        const coords = hospital.location?.coordinates;
        if (coords && coords[0] !== 0 && coords[1] !== 0) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`, '_blank');
        } else {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.address || hospital.name)}`, '_blank');
        }
    };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    const displayHospitals = sortByDistance && nearbyHospitals.length > 0 ? nearbyHospitals : hospitals;
    const selectedHospitalObj = displayHospitals.find(h => h._id === selectedHospital);
    const selectedHospitalName = selectedHospitalObj?.name || '';

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-6xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="mb-10">
                        <span className="text-sm font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest">Smart Scheduling</span>
                        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Appointment <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Manager</span>
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-gray-400">Book appointments at the nearest blood banks and hospitals.</p>
                    </div>
                </ScrollReveal>

                {/* Nearest Hospital Suggestion */}
                <ScrollReveal direction="up" delay={0.1}>
                    <GlassCard className="p-5 mb-8 border-blue-500/20">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <span className="text-2xl">📍</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">Find Nearest Hospitals</h3>
                                    <p className="text-xs text-slate-500 dark:text-gray-400">
                                        {userLocation ? `Location detected: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                                            : 'Use your location to find the closest donation centers'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <GlowButton
                                    variant="outline"
                                    size="sm"
                                    onClick={findNearestHospitals}
                                    disabled={locationLoading}
                                >
                                    {locationLoading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                            Detecting...
                                        </span>
                                    ) : '📍 Detect My Location'}
                                </GlowButton>
                                {nearbyHospitals.length > 0 && (
                                    <GlowButton
                                        variant={sortByDistance ? 'primary' : 'outline'}
                                        size="sm"
                                        onClick={() => setSortByDistance(!sortByDistance)}
                                    >
                                        {sortByDistance ? '✓ Sorted by Distance' : 'Sort by Distance'}
                                    </GlowButton>
                                )}
                            </div>
                        </div>

                        {nearbyHospitals.length > 0 && sortByDistance && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                {nearbyHospitals.slice(0, 3).map((h, i) => (
                                    <motion.div
                                        key={h._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        onClick={() => setSelectedHospital(h._id)}
                                        className={`p-3 rounded-xl cursor-pointer transition-all border ${
                                            selectedHospital === h._id
                                                ? 'bg-red-500/10 border-red-500/40'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{h.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{h.address}</p>
                                            </div>
                                            {i === 0 && (
                                                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold">NEAREST</span>
                                            )}
                                        </div>
                                        {h.distance !== undefined && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-xs font-medium text-blue-500">{h.distance} km away</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openDirections(h); }}
                                                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                                                >
                                                    Get Directions
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                </ScrollReveal>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Booking Form */}
                    <ScrollReveal direction="left">
                        <GlassCard className="p-8">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">📅 Book New Appointment</h2>

                            {booked ? (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                                    <span className="text-6xl block mb-4">✅</span>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Appointment Booked!</h3>
                                    <p className="text-slate-500 dark:text-gray-400 text-sm mb-1">{selectedHospitalName}</p>
                                    <p className="text-slate-500 dark:text-gray-400 text-sm mb-1">{selectedDate} at {selectedTime}</p>
                                    {selectedHospitalObj && (
                                        <button
                                            onClick={() => openDirections(selectedHospitalObj)}
                                            className="text-sm text-blue-500 hover:text-blue-400 underline mt-2"
                                        >
                                            🗺️ Get Directions to Hospital
                                        </button>
                                    )}
                                    <GlowButton variant="outline" className="mt-6" onClick={() => {
                                        setBooked(false);
                                        setSelectedHospital('');
                                        setSelectedDate('');
                                        setSelectedTime('');
                                    }}>
                                        Book Another
                                    </GlowButton>
                                </motion.div>
                            ) : (
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm text-slate-600 dark:text-gray-300 mb-2">Select Hospital</label>
                                        <select
                                            value={selectedHospital}
                                            onChange={(e) => setSelectedHospital(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:border-red-500/50 focus:outline-none transition-all appearance-none"
                                        >
                                            <option value="">Choose a hospital...</option>
                                            {displayHospitals.map((h) => (
                                                <option key={h._id} value={h._id}>
                                                    {h.name}{h.distance !== undefined ? ` (${h.distance} km)` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedHospitalObj && (
                                        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedHospitalObj.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-gray-400">{selectedHospitalObj.address}</p>
                                                    {selectedHospitalObj.phone && (
                                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">📞 {selectedHospitalObj.phone}</p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => openDirections(selectedHospitalObj)}
                                                    className="text-xs text-blue-500 hover:text-blue-400 whitespace-nowrap"
                                                >
                                                    🗺️ Directions
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm text-slate-600 dark:text-gray-300 mb-2">Select Date</label>
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            min={minDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:border-red-500/50 focus:outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-slate-600 dark:text-gray-300 mb-2">Select Time Slot</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {timeSlots.map((time) => {
                                                const isBooked = bookedSlots.includes(time);
                                                return (
                                                    <button
                                                        key={time}
                                                        onClick={() => !isBooked && setSelectedTime(time)}
                                                        disabled={isBooked}
                                                        title={isBooked ? 'This slot is already booked' : `Select ${time}`}
                                                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                            isBooked
                                                                ? 'bg-red-500/10 border border-red-500/30 text-red-400 cursor-not-allowed line-through opacity-60'
                                                                : selectedTime === time
                                                                    ? 'bg-red-500/20 border border-red-500/50 text-red-500 dark:text-red-300'
                                                                    : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {time} {isBooked && '✗'}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {bookedSlots.length > 0 && (
                                            <p className="text-xs text-slate-400 mt-2">
                                                ⚠️ {bookedSlots.length} slot{bookedSlots.length > 1 ? 's' : ''} already booked for this date
                                            </p>
                                        )}
                                    </div>

                                    {error && (
                                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
                                            {error}
                                        </div>
                                    )}

                                    <GlowButton size="lg" className="w-full" onClick={handleBook}
                                        disabled={!selectedHospital || !selectedDate || !selectedTime || booking}>
                                        {booking ? 'Booking...' : 'Book Appointment'}
                                    </GlowButton>
                                </div>
                            )}
                        </GlassCard>
                    </ScrollReveal>

                    {/* Right Column: Map + Campaigns + Appointments */}
                    <div className="space-y-6">
                        {/* Google Map Preview */}
                        {selectedHospitalObj && apiKey && (
                            <ScrollReveal direction="right">
                                <GlassCard className="p-0 overflow-hidden">
                                    <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">📍 Hospital Location</h3>
                                        <button
                                            onClick={() => setShowMap(!showMap)}
                                            className="text-xs text-blue-500 hover:text-blue-400"
                                        >
                                            {showMap ? 'Hide Map' : 'Show Map'}
                                        </button>
                                    </div>
                                    <AnimatePresence>
                                        {showMap && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 250 }}
                                                exit={{ height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <iframe
                                                    width="100%"
                                                    height="250"
                                                    style={{ border: 0 }}
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                    src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(selectedHospitalObj.address || selectedHospitalObj.name)}&zoom=14`}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </GlassCard>
                            </ScrollReveal>
                        )}

                        {/* Upcoming Campaigns */}
                        {campaigns.length > 0 && (
                            <ScrollReveal direction="right" delay={0.1}>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                    🎯 Upcoming Donation Campaigns
                                </h2>
                                <div className="space-y-3">
                                    {campaigns.slice(0, 3).map((camp) => (
                                        <GlassCard key={camp._id} className="p-4 border-purple-500/20 hover:border-purple-500/40 transition-all">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{camp.title}</h3>
                                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                                        📍 {camp.location?.address || 'TBA'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-gray-400">
                                                        📅 {new Date(camp.date).toLocaleDateString()} — {new Date(camp.endDate).toLocaleDateString()}
                                                    </p>
                                                    {camp.bloodTypesNeeded && camp.bloodTypesNeeded.length > 0 && (
                                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                                            {camp.bloodTypesNeeded.map(bt => (
                                                                <span key={bt} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold">{bt}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold">
                                                        {camp.rsvpList?.length || 0}/{camp.maxCapacity}
                                                    </span>
                                                </div>
                                            </div>
                                        </GlassCard>
                                    ))}
                                </div>
                            </ScrollReveal>
                        )}

                        {/* Existing Appointments */}
                        <ScrollReveal direction="right">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Your Appointments</h2>
                            <div className="space-y-4">
                                {appointments.length > 0 ? appointments.map((apt) => (
                                    <GlassCard key={apt._id} className="p-5">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                                    {apt.hospitalId?.name || 'Hospital'}
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                                                    {new Date(apt.date).toLocaleDateString()} at {apt.timeSlot}
                                                </p>
                                                {apt.hospitalId?.address && (
                                                    <p className="text-xs text-slate-400 mt-0.5">{apt.hospitalId.address}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                    apt.status === 'Scheduled' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                                    apt.status === 'Completed' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                                    apt.status === 'Cancelled' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                                    'bg-slate-500/10 text-slate-600 dark:text-gray-400'
                                                }`}>
                                                    {apt.status}
                                                </span>
                                                {apt.status === 'Scheduled' && (
                                                    <button
                                                        onClick={() => handleCancel(apt._id)}
                                                        className="text-xs text-red-500 hover:text-red-400 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </GlassCard>
                                )) : (
                                    <GlassCard className="p-8 text-center">
                                        <span className="text-4xl block mb-3">📅</span>
                                        <p className="text-sm text-slate-500 dark:text-gray-400">No appointments yet. Book your first one!</p>
                                    </GlassCard>
                                )}
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </div>
        </div>
    );
}
