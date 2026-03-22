'use client';

import { useState, useCallback } from 'react';
import { GoogleMap, Marker, Circle } from '@react-google-maps/api';
import { motion } from 'framer-motion';
import GlassCard from './GlassCard';

interface LocationPickerProps {
    onLocationSelect: (lat: number, lng: number) => void;
    currentLocation?: { lat: number; lng: number };
    title?: string;
    description?: string;
}

const mapContainerStyle = {
    width: '100%',
    height: '500px',
    borderRadius: '12px',
};

const defaultCenter = {
    lat: 7.8731,
    lng: 80.7718,
};

export default function LocationPicker({
    onLocationSelect,
    currentLocation,
    title = 'Mark Your Location',
    description = 'Click on the map to mark your location or drag the marker',
}: LocationPickerProps) {
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
        currentLocation || null
    );
    const [markerDragging, setMarkerDragging] = useState(false);

    const handleMapClick = useCallback((e: any) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setSelectedLocation({ lat, lng });
    }, []);

    const handleMarkerDragEnd = useCallback((e: any) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setSelectedLocation({ lat, lng });
    }, []);

    const handleConfirm = () => {
        if (!selectedLocation) return;
        onLocationSelect(selectedLocation.lat, selectedLocation.lng);
    };

    const handleUseCurrentLocation = () => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setSelectedLocation({ lat: latitude, lng: longitude });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('Unable to get your current location. Please enable location services.');
                }
            );
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                {description && (
                    <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">{description}</p>
                )}
            </div>

            <GlassCard className="p-4">
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={selectedLocation || defaultCenter}
                    zoom={10}
                    onClick={handleMapClick}
                    options={{
                        mapTypeControl: true,
                        fullscreenControl: true,
                        streetViewControl: false,
                    }}
                >
                    {selectedLocation && (
                        <>
                            <Marker
                                position={selectedLocation}
                                draggable={true}
                                onDragStart={() => setMarkerDragging(true)}
                                onDragEnd={(e) => {
                                    handleMarkerDragEnd(e);
                                    setMarkerDragging(false);
                                }}
                                icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 10,
                                    fillColor: '#ef4444',
                                    fillOpacity: 0.8,
                                    strokeColor: 'white',
                                    strokeWeight: 3,
                                }}
                            />
                            <Circle
                                center={selectedLocation}
                                radius={500}
                                options={{
                                    fillColor: '#ef4444',
                                    fillOpacity: 0.1,
                                    strokeColor: '#ef4444',
                                    strokeOpacity: 0.3,
                                    strokeWeight: 2,
                                }}
                            />
                        </>
                    )}
                </GoogleMap>
            </GlassCard>

            {selectedLocation && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg"
                >
                    <p className="text-sm text-slate-900 dark:text-white">
                        <span className="font-semibold">Latitude:</span> {selectedLocation.lat.toFixed(6)}
                    </p>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                        <span className="font-semibold">Longitude:</span> {selectedLocation.lng.toFixed(6)}
                    </p>
                </motion.div>
            )}

            <div className="flex gap-3">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUseCurrentLocation}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all"
                >
                    📍 Use Current Location
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    disabled={!selectedLocation}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                        selectedLocation
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-red-300 text-red-100 cursor-not-allowed'
                    }`}
                >
                    ✓ Confirm Location
                </motion.button>
            </div>
        </div>
    );
}
