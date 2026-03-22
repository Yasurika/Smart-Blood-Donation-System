'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, HeatmapLayer, InfoWindow } from '@react-google-maps/api';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import ScrollReveal from '@/components/animations/ScrollReveal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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

const mapContainerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '12px',
};

const defaultCenter = {
    lat: 7.8731,
    lng: 80.7718,
};

export default function BloodHeatmapPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const mapRef = useRef<google.maps.Map | null>(null);

    const [hospitals, setHospitals] = useState<HospitalWithIntensity[]>([]);
    const [filteredHospitals, setFilteredHospitals] = useState<HospitalWithIntensity[]>([]);
    const [selectedBloodType, setSelectedBloodType] = useState<string>('All');
    const [loading, setLoading] = useState(true);
    const [selectedHospital, setSelectedHospital] = useState<HospitalWithIntensity | null>(null);
    const [mapMode, setMapMode] = useState<'markers' | 'heatmap'>('markers');
    const [showStockFilter, setShowStockFilter] = useState(false);
    const [minStockFilter, setMinStockFilter] = useState(0);

    // Auth guard
    useEffect(() => {
        if (authStatus === 'loading') return;
        if (!session?.user) {
            router.push('/auth/login');
        }
    }, [session, authStatus, router]);

    // Fetch hospitals with blood stock
    useEffect(() => {
        const fetchHospitals = async () => {
            try {
                const res = await fetch('/api/hospitals?populate=bloodStocks');
                if (res.ok) {
                    const data = await res.json();
                    const hospitalsWithIntensity = (data.data || []).map((h: Hospital) => {
                        const stocks = h.bloodStocks || {};
                        const totalUnits = Object.values(stocks).reduce((sum: number, val: any) => sum + (val || 0), 0);
                        return {
                            ...h,
                            intensity: Math.min(totalUnits / 100, 1), // Normalize intensity 0-1
                        };
                    });
                    setHospitals(hospitalsWithIntensity);
                    setFilteredHospitals(hospitalsWithIntensity);
                }
            } catch (err) {
                console.error('Failed to fetch hospitals:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHospitals();
    }, []);

    // Filter hospitals based on blood type and stock
    useEffect(() => {
        let filtered = hospitals.filter(h => {
            const stocks = h.bloodStocks || {};
            if (selectedBloodType === 'All') {
                // Show hospitals that have any blood type with stock
                const hasAnyBlood = Object.values(stocks).some(units => units && units > minStockFilter);
                return hasAnyBlood;
            }
            const hasBloodType = stocks[selectedBloodType] && stocks[selectedBloodType] > minStockFilter;
            return hasBloodType;
        });

        setFilteredHospitals(filtered);
        setSelectedHospital(null);
    }, [selectedBloodType, minStockFilter, hospitals]);

    // Prepare heatmap data (only after google is loaded)
    const heatmapData = typeof google !== 'undefined' ? filteredHospitals.map(h => ({
        location: new google.maps.LatLng(h.location.coordinates[1], h.location.coordinates[0]),
        weight: h.intensity * 10,
    })) : [];

    const handleMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        if (filteredHospitals.length > 0 && typeof google !== 'undefined') {
            const bounds = new google.maps.LatLngBounds();
            filteredHospitals.forEach(h => {
                bounds.extend(
                    new google.maps.LatLng(h.location.coordinates[1], h.location.coordinates[0])
                );
            });
            map.fitBounds(bounds, 50);
        }
    }, [filteredHospitals]);

    if (authStatus === 'loading' || loading) {
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
                        <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Interactive Map</span>
                        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Blood Donation <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Heatmap</span>
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-gray-400">Find hospitals with available blood types in your area</p>
                    </div>
                </ScrollReveal>

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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

                    {/* Stock Filter */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <GlassCard className="p-4">
                            <label className="text-sm font-semibold text-slate-900 dark:text-white block mb-3">
                                📦 Min Stock
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="500"
                                value={minStockFilter}
                                onChange={(e) => setMinStockFilter(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </GlassCard>
                    </motion.div>

                    {/* Stats */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <GlassCard className="p-4">
                            <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Available Sites</p>
                            <p className="text-2xl font-bold text-red-500">{filteredHospitals.length}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                                Total Hospitals: {hospitals.length}
                            </p>
                        </GlassCard>
                    </motion.div>
                </div>

                {/* Map */}
                <ScrollReveal direction="up">
                    <GlassCard className="p-4 mb-8">
                        <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} libraries={['visualization']}>
                            <GoogleMap
                                mapContainerStyle={mapContainerStyle}
                                center={defaultCenter}
                                zoom={6}
                                onLoad={handleMapLoad}
                                options={{
                                    mapTypeControl: true,
                                    streetViewControl: true,
                                    fullscreenControl: true,
                                    styles: [
                                        {
                                            featureType: 'all',
                                            elementType: 'labels.text.fill',
                                            stylers: [{ color: '#94a3b8' }],
                                        },
                                    ],
                                }}
                            >
                                {mapMode === 'heatmap' && heatmapData.length > 0 && (
                                    <HeatmapLayer data={heatmapData} />
                                )}

                                {mapMode === 'markers' && typeof google !== 'undefined' &&
                                    filteredHospitals.map(hospital => (
                                        <Marker
                                            key={hospital._id}
                                            position={{
                                                lat: hospital.location.coordinates[1],
                                                lng: hospital.location.coordinates[0],
                                            }}
                                            title={hospital.name}
                                            onClick={() => setSelectedHospital(hospital)}
                                            icon={{
                                                path: google.maps.SymbolPath.CIRCLE,
                                                scale: 8,
                                                fillColor: BLOOD_COLORS[selectedBloodType],
                                                fillOpacity: 0.8,
                                                strokeColor: 'white',
                                                strokeWeight: 2,
                                            }}
                                        />
                                    ))}

                                {selectedHospital && mapMode === 'markers' && (
                                    <InfoWindow
                                        position={{
                                            lat: selectedHospital.location.coordinates[1],
                                            lng: selectedHospital.location.coordinates[0],
                                        }}
                                        onCloseClick={() => setSelectedHospital(null)}
                                    >
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg max-w-xs">
                                            <h3 className="font-bold text-slate-900 dark:text-white">{selectedHospital.name}</h3>
                                            <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">{selectedHospital.district}</p>
                                            {selectedHospital.address && (
                                                <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">{selectedHospital.address}</p>
                                            )}
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                {selectedBloodType === 'All' ? (
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Available Types:</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {BLOOD_TYPES.map(type => {
                                                                const units = selectedHospital.bloodStocks?.[type] || 0;
                                                                return units > 0 ? (
                                                                    <span key={type} className="px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: BLOOD_COLORS[type] }}>
                                                                        {type}: {units}
                                                                    </span>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                                                        {selectedBloodType} Stock: {selectedHospital.bloodStocks?.[selectedBloodType] || 0} units
                                                    </p>
                                                )}
                                                {selectedHospital.phone && (
                                                    <p className="text-xs text-slate-600 dark:text-gray-400 mt-2">
                                                        📞 {selectedHospital.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </InfoWindow>
                                )}
                            </GoogleMap>
                        </LoadScript>
                    </GlassCard>
                </ScrollReveal>

                {/* Hospital List */}
                <ScrollReveal direction="up">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            {selectedBloodType === 'All' ? 'All Available Hospitals' : `Hospitals with ${selectedBloodType}`} ({filteredHospitals.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredHospitals.map((hospital, i) => (
                                <motion.div
                                    key={hospital._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => setSelectedHospital(hospital)}
                                    className="cursor-pointer"
                                >
                                    <GlassCard className={`p-4 transition-all hover:border-red-500/50 ${
                                        selectedHospital?._id === hospital._id ? 'border-red-500 bg-red-500/5' : ''
                                    }`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                                {hospital.name}
                                            </h3>
                                            <span
                                                className="px-2 py-1 rounded text-xs font-bold text-white"
                                                style={{ backgroundColor: selectedBloodType === 'All' ? '#ef4444' : BLOOD_COLORS[selectedBloodType] }}
                                            >
                                                {selectedBloodType === 'All' ? (
                                                    `${Object.keys(hospital.bloodStocks || {}).length} types`
                                                ) : (
                                                    `${hospital.bloodStocks?.[selectedBloodType] || 0} units`
                                                )}
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
                        {filteredHospitals.length === 0 && (
                            <GlassCard className="p-8 text-center">
                                <p className="text-slate-500 dark:text-gray-400">
                                    No hospitals found with {selectedBloodType} blood type above {minStockFilter} units
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
