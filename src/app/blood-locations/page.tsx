'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, HeatmapLayer, InfoWindow } from '@react-google-maps/api';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import GlassCard from '@/components/ui/GlassCard';
import ScrollReveal from '@/components/animations/ScrollReveal';

interface Hospital {
    _id: string;
    name: string;
    district: string;
    location: {
        type: string;
        coordinates: [number, number]; // [longitude, latitude]
    };
    bloodStocks?: Record<string, number>;
    facilities?: string[];
    phone?: string;
    address?: string;
}

interface Donor {
    _id: string;
    name: string;
    district: string;
    location: {
        type: string;
        coordinates: [number, number]; // [longitude, latitude]
    };
    bloodType: string;
    type?: 'donor';
}

interface Location {
    _id: string;
    name: string;
    district: string;
    location: {
        type: string;
        coordinates: [number, number];
    };
    bloodType?: string;
    bloodStocks?: Record<string, number>;
    facilities?: string[];
    phone?: string;
    address?: string;
    type?: 'donor' | 'hospital';
    intensity?: number;
}

interface HospitalWithIntensity extends Hospital {
    intensity: number;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const BLOOD_COLORS: Record<string, string> = {
    'A+': '#ef4444', 'A-': '#f97316',
    'B+': '#3b82f6', 'B-': '#1e40af',
    'AB+': '#8b5cf6', 'AB-': '#6d28d9',
    'O+': '#22c55e', 'O-': '#16a34a',
};

// Helper function to create SVG circle icons
const createCircleIcon = (color: string, size: number = 30) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="2"/>
    </svg>`;
    try {
        const base64 = btoa(svg);
        return {
            url: `data:image/svg+xml;base64,${base64}`,
            scaledSize: { width: size, height: size }
        };
    } catch (e) {
        return undefined;
    }
};

const mapContainerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '12px',
};

const defaultCenter = {
    lat: 7.8731,
    lng: 80.7718,
};

export default function BloodDonationMapPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const mapRef = useRef<google.maps.Map | null>(null);
    const userRole = session?.user?.role || 'donor';
    const canViewDonors = userRole === 'hospital' || userRole === 'admin';

    // Redirect to login if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    // Show loading while checking auth status
    if (status === 'loading') {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    // Don't render page if not authenticated
    if (!session?.user) {
        return null;
    }

    const [hospitals, setHospitals] = useState<HospitalWithIntensity[]>([]);
    const [donors, setDonors] = useState<(Donor & { intensity: number })[]>([]);
    const [filteredHospitals, setFilteredHospitals] = useState<HospitalWithIntensity[]>([]);
    const [filteredDonors, setFilteredDonors] = useState<(Donor & { intensity: number })[]>([]);
    const [selectedBloodType, setSelectedBloodType] = useState<string>('All');
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [mapMode, setMapMode] = useState<'markers' | 'heatmap'>('markers');
    const [showDonors, setShowDonors] = useState(canViewDonors);
    const [mapsLoaded, setMapsLoaded] = useState(false);

    // Fetch hospitals and optionally donors
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const hospitalsRes = await fetch('/api/hospitals?limit=100');

                if (hospitalsRes.ok) {
                    const data = await hospitalsRes.json();
                    const hospitalsWithIntensity = (data.data || []).map((h: Hospital) => {
                        return {
                            ...h,
                            type: 'hospital' as const,
                            intensity: 0.7,
                        };
                    });
                    setHospitals(hospitalsWithIntensity);
                    setFilteredHospitals(hospitalsWithIntensity);
                }

                // Fetch donors only if user is hospital or admin
                if (canViewDonors) {
                    const donorsRes = await fetch('/api/locations?type=donors');
                    if (donorsRes.ok) {
                        const data = await donorsRes.json();
                        const donorsWithIntensity = (data.data || [])
                            .filter((d: any) => d.type === 'donor' && d.location?.coordinates)
                            .map((d: any) => ({
                                ...d,
                                _id: d._id,
                                name: d.name,
                                location: d.location,
                                bloodType: d.bloodType,
                                district: d.district,
                                intensity: 0.8,
                            }));
                        setDonors(donorsWithIntensity);
                        setFilteredDonors(donorsWithIntensity);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch locations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchLocations();
    }, [canViewDonors]);

    // Show all hospitals when "All" is selected.
    useEffect(() => {
        if (selectedBloodType === 'All') {
            setFilteredHospitals(hospitals);
            setSelectedLocation(null);
        }
    }, [hospitals, selectedBloodType]);

    // If a blood type is selected, fetch hospitals that currently have available stock for that type.
    useEffect(() => {
        if (selectedBloodType === 'All') return;

        const fetchFilteredHospitals = async () => {
            try {
                const res = await fetch(`/api/hospitals?limit=100&bloodType=${encodeURIComponent(selectedBloodType)}`);
                if (!res.ok) {
                    setFilteredHospitals([]);
                    return;
                }

                const data = await res.json();
                const filtered = (data.data || []).map((h: Hospital) => ({
                    ...h,
                    type: 'hospital' as const,
                    intensity: 0.7,
                }));

                setFilteredHospitals(filtered);
                setSelectedLocation(null);
            } catch {
                setFilteredHospitals([]);
            }
        };

        fetchFilteredHospitals();
    }, [selectedBloodType]);
    
    // Filter donors based on blood type
    useEffect(() => {
        if (!canViewDonors) {
            setFilteredDonors([]);
            return;
        }
        let filtered = donors.filter(d => {
            if (selectedBloodType === 'All') {
                return true;
            }
            return d.bloodType === selectedBloodType;
        });
        setFilteredDonors(filtered);
    }, [selectedBloodType, donors, canViewDonors]);
    
    // Prepare combined locations
    const combinedLocations = [...filteredHospitals, ...(showDonors && canViewDonors ? filteredDonors : [])];
    
    // Prepare heatmap data (only after google maps is loaded)
    const heatmapData = mapsLoaded && typeof google !== 'undefined' && google.maps && combinedLocations.length > 0
        ? combinedLocations.map(location => ({
            location: new google.maps.LatLng(location.location.coordinates[1], location.location.coordinates[0]),
            weight: location.intensity * 10,
        }))
        : [];

    const handleMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        setMapsLoaded(true);
        if (combinedLocations.length > 0 && typeof google !== 'undefined' && google.maps) {
            const bounds = new google.maps.LatLngBounds();
            combinedLocations.forEach(location => {
                bounds.extend(
                    new google.maps.LatLng(location.location.coordinates[1], location.location.coordinates[0])
                );
            });
            map.fitBounds(bounds, 50);
        }
    }, [combinedLocations]);

    if (loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-7xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="mb-8">
                        <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Find Blood Donations</span>
                        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Blood Donation <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Locations</span>
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-gray-400">Find hospitals offering blood donations near you</p>
                    </div>
                </ScrollReveal>

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                    {/* Blood Type Filter */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <GlassCard className="p-4">
                            <label className="text-sm font-semibold text-slate-900 dark:text-white block mb-3">
                                🩸 Blood Type
                            </label>
                            <select
                                value={selectedBloodType}
                                onChange={(e) => setSelectedBloodType(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="All">🩸 All Blood Types</option>
                                {BLOOD_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </GlassCard>
                    </motion.div>

                    {/* Map Mode Toggle */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <GlassCard className="p-4">
                            <label className="text-sm font-semibold text-slate-900 dark:text-white block mb-3">
                                🗺️ View Mode
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMapMode('markers')}
                                    className={`flex-1 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${
                                        mapMode === 'markers'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                >
                                    📍 Markers
                                </button>
                                <button
                                    onClick={() => setMapMode('heatmap')}
                                    className={`flex-1 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${
                                        mapMode === 'heatmap'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                >
                                    🔥 Heatmap
                                </button>
                            </div>
                        </GlassCard>
                    </motion.div>

                    {/* Donors Toggle - Only visible to hospitals and admins */}
                    {canViewDonors && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <GlassCard className="p-4">
                                <label className="text-sm font-semibold text-slate-900 dark:text-white block mb-3">
                                    👥 Donors
                                </label>
                                <button
                                    onClick={() => setShowDonors(!showDonors)}
                                    className={`w-full px-3 py-2 rounded-lg font-semibold text-xs transition-all ${
                                        showDonors
                                            ? 'bg-green-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                >
                                    {showDonors ? '✓ Visible' : '✕ Hidden'}
                                </button>
                            </GlassCard>
                        </motion.div>
                    )}

                    {/* Stats */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: canViewDonors ? 0.3 : 0.2 }}>
                        <GlassCard className="p-4">
                            <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Locations</p>
                            <p className="text-2xl font-bold text-red-500">{combinedLocations.length}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                                {filteredHospitals.length > 0 && `${filteredHospitals.length} hospitals`}
                                {canViewDonors && showDonors && filteredDonors.length > 0 && `, ${filteredDonors.length} donors`}
                            </p>
                        </GlassCard>
                    </motion.div>
                </div>

                {/* Map */}
                <ScrollReveal direction="up">
                    <GlassCard className="p-4 mb-8">
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={defaultCenter}
                            zoom={6}
                            onLoad={handleMapLoad}
                            options={{
                                mapTypeControl: true,
                                fullscreenControl: true,
                            }}
                        >
                            {mapMode === 'heatmap' && heatmapData.length > 0 && (
                                <HeatmapLayer data={heatmapData} />
                            )}

                            {mapMode === 'markers' && typeof google !== 'undefined' && google.maps && (
                                <>
                                    {filteredHospitals.map(hospital => (
                                        <Marker
                                            key={`hospital-${hospital._id}`}
                                            position={{
                                                lat: hospital.location.coordinates[1],
                                                lng: hospital.location.coordinates[0],
                                            }}
                                            title={hospital.name}
                                            onClick={() => setSelectedLocation(hospital)}
                                            icon={createCircleIcon('#3b82f6', 40) as any}
                                        />
                                    ))}

                                    {canViewDonors && showDonors && filteredDonors.map(donor => (
                                        <Marker
                                            key={`donor-${donor._id}`}
                                            position={{
                                                lat: donor.location.coordinates[1],
                                                lng: donor.location.coordinates[0],
                                            }}
                                            title={donor.name}
                                            onClick={() => setSelectedLocation(donor)}
                                            icon={createCircleIcon(BLOOD_COLORS[donor.bloodType], 30) as any}
                                        />
                                    ))}
                                </>
                            )}

                            {selectedLocation && mapMode === 'markers' && (
                                <InfoWindow
                                    position={{
                                        lat: selectedLocation.location.coordinates[1],
                                        lng: selectedLocation.location.coordinates[0],
                                    }}
                                    onCloseClick={() => setSelectedLocation(null)}
                                >
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg max-w-xs">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-bold text-slate-900 dark:text-white">{selectedLocation.name}</h3>
                                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: selectedLocation.bloodType ? BLOOD_COLORS[selectedLocation.bloodType] : '#6b7280', color: 'white' }}>
                                                {selectedLocation.bloodType || selectedLocation.type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">{selectedLocation.district}</p>
                                        {selectedLocation.type === 'hospital' && selectedLocation.address && (
                                            <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">{selectedLocation.address}</p>
                                        )}
                                        {selectedLocation.type === 'hospital' && (
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                                                    Hospital location available
                                                </p>
                                            </div>
                                        )}
                                        {selectedLocation.phone && (
                                            <p className="text-xs text-slate-600 dark:text-gray-400 mt-2">
                                                📞 {selectedLocation.phone}
                                            </p>
                                        )}
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
                    </GlassCard>
                </ScrollReveal>

                {/* Locations List */}
                <ScrollReveal direction="up">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            {selectedBloodType === 'All' ? 'All Locations' : `${selectedBloodType} Blood Type Locations`} ({combinedLocations.length})
                        </h2>

                        {filteredHospitals.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                                    <span className="text-lg">🏥</span> Hospitals ({filteredHospitals.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredHospitals.map((hospital, i) => (
                                        <motion.div
                                            key={hospital._id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            onClick={() => setSelectedLocation(hospital)}
                                            className="cursor-pointer"
                                        >
                                            <GlassCard className="p-4 hover:border-blue-500/50 transition-all">
                                                <div className="flex items-start justify-between mb-2">
                                                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                                        {hospital.name}
                                                    </h3>
                                                    <span className="text-xs text-slate-600 dark:text-gray-300 font-medium bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                                                        Hospital
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-gray-400">{hospital.district}</p>
                                                {hospital.address && (
                                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 line-clamp-2">
                                                        {hospital.address}
                                                    </p>
                                                )}
                                                {hospital.phone && (
                                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                                                        📞 {hospital.phone}
                                                    </p>
                                                )}
                                            </GlassCard>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {canViewDonors && filteredDonors.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                                    <span className="text-lg">👥</span> Donors ({filteredDonors.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDonors.map((donor, i) => (
                                        <motion.div
                                            key={donor._id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: (i + filteredHospitals.length) * 0.05 }}
                                            onClick={() => setSelectedLocation(donor)}
                                            className="cursor-pointer"
                                        >
                                            <GlassCard className="p-4 hover:border-green-500/50 transition-all">
                                                <div className="flex items-start justify-between mb-2">
                                                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                                        {donor.name}
                                                    </h3>
                                                    <span
                                                        className="px-2 py-1 rounded text-xs font-bold text-white"
                                                        style={{ backgroundColor: BLOOD_COLORS[donor.bloodType] }}
                                                    >
                                                        {donor.bloodType}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-gray-400">{donor.district}</p>
                                                <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                                                    ✓ Verified Donor
                                                </p>
                                            </GlassCard>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {combinedLocations.length === 0 && (
                            <GlassCard className="p-8 text-center">
                                <p className="text-slate-500 dark:text-gray-400">
                                    No locations found
                                    {selectedBloodType !== 'All' && ` with ${selectedBloodType} blood type`}
                                </p>
                            </GlassCard>
                        )}
                    </div>
                </ScrollReveal>

                {/* Legend */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {BLOOD_TYPES.map(type => (
                        <GlassCard key={type} className="p-3">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: BLOOD_COLORS[type] }}
                                />
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">{type}</span>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            </div>
        </div>
    );
}
