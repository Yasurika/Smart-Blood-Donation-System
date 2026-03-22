'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import SmartAppointmentRecommender from '@/components/appointments/SmartAppointmentRecommender';
import { useSession } from 'next-auth/react';
import { Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';

interface Appointment {
  _id: string;
  hospitalId: { _id: string; name: string; address?: string } | null;
  date: string;
  timeSlot: string;
  status: string;
}

const timeSlots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

export default function AppointmentsPage() {
  const { data: session } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'recommendations' | 'bookings'>('recommendations');
  const [selectedHospitalToBook, setSelectedHospitalToBook] = useState<{
    hospitalId: string;
    date: string;
    timeSlot: string;
  } | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [booking, setBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Load appointments
  useEffect(() => {
    async function fetchData() {
      try {
        const apptRes = await fetch('/api/appointments');
        if (apptRes.ok) {
          const apptData = await apptRes.json();
          setAppointments(apptData.data || []);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Detect user location
  const findNearestHospitals = useCallback(async () => {
    setLocationLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });

      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });
    } catch {
      setError('Could not detect your location. The recommender will show hospitals in your region.');
    } finally {
      setLocationLoading(false);
    }
  }, []);

  // Fetch booked slots for selected hospital and date
  useEffect(() => {
    if (!selectedHospitalToBook || !selectedDate) {
      setBookedSlots([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/appointments?bookedSlots=true&hospitalId=${selectedHospitalToBook.hospitalId}&date=${selectedDate}`
        );
        if (res.ok) {
          const data = await res.json();
          setBookedSlots(data.data?.bookedSlots || []);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [selectedHospitalToBook, selectedDate]);

  // Handle appointment booking
  const handleBook = async () => {
    if (!selectedHospitalToBook || !selectedDate || !selectedTime) {
      setError('Please select date and time');
      return;
    }
    setBooking(true);
    setError('');

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: selectedHospitalToBook.hospitalId,
          date: selectedDate,
          timeSlot: selectedTime,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Refresh appointments list
        const refreshRes = await fetch('/api/appointments');
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setAppointments(refreshData.data || []);
        }
        // Reset form
        setSelectedHospitalToBook(null);
        setSelectedDate('');
        setSelectedTime('');
        setActiveTab('bookings');
      } else {
        setError(data.error || 'Failed to book appointment.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  // Handle cancellation
  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Cancelled' }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a._id === id ? { ...a, status: 'Cancelled' } : a))
        );
      }
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const upcomingAppointments = appointments.filter((a) => a.status === 'Scheduled');
  const pastAppointments = appointments.filter(
    (a) => a.status === 'Completed' || a.status === 'NoShow'
  );

  if (loading) {
    return (
      <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 px-6 pb-20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <ScrollReveal direction="up">
          <div className="mb-10">
            <span className="text-sm font-semibold text-red-500 dark:text-red-400 uppercase tracking-widest">
              Smart Scheduling
            </span>
            <h1 className="mt-2 text-4xl md:text-5xl font-bold text-white">
              Appointment <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Manager</span>
            </h1>
            <p className="mt-3 text-gray-400 text-lg">
              Get intelligent recommendations for your blood donation appointments
            </p>
          </div>
        </ScrollReveal>

        {/* Tab Navigation */}
        <ScrollReveal direction="up" delay={0.05}>
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'recommendations'
                  ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg shadow-red-500/50'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              ✨ Smart Recommendations
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'bookings'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/50'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📅 My Appointments
              {upcomingAppointments.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {upcomingAppointments.length}
                </span>
              )}
            </button>
          </div>
        </ScrollReveal>

        {/* Error Message */}
        {error && (
          <motion.div
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-gray-200">{error}</p>
          </motion.div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <ScrollReveal direction="up" delay={0.1}>
            <div className="space-y-6">
              {/* Location Detection Banner */}
              <GlassCard className="p-5 border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin size={20} className="text-blue-400" />
                  <div>
                    <h3 className="font-semibold text-white">Improve Recommendations</h3>
                    <p className="text-xs text-gray-400">Share your location for distance-based recommendations</p>
                  </div>
                </div>
                <GlowButton
                  onClick={findNearestHospitals}
                  disabled={locationLoading}
                  variant={userLocation ? 'secondary' : 'primary'}
                  size="sm"
                >
                  {locationLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Detecting...
                    </span>
                  ) : userLocation ? (
                    '✓ Location Enabled'
                  ) : (
                    '📍 Share Location'
                  )}
                </GlowButton>
              </GlassCard>

              {/* Smart Recommender Component */}
              <SmartAppointmentRecommender
                userLocation={userLocation}
                onSelectHospital={(hospitalId, date, timeSlot) => {
                  setSelectedHospitalToBook({ hospitalId, date, timeSlot });
                  setActiveTab('bookings');
                }}
              />
            </div>
          </ScrollReveal>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <ScrollReveal direction="up" delay={0.1}>
            <div className="space-y-8">
              {/* Booking Form (when hospital selected) */}
              {selectedHospitalToBook && (
                <GlassCard className="p-6 border-green-500/20">
                  <h3 className="text-xl font-bold text-white mb-4">Complete Your Booking</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Date Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Select Date</label>
                      <input
                        type="date"
                        min={minDate}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                      />
                    </div>

                    {/* Time Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Select Time</label>
                      <select
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        disabled={!selectedDate}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500 disabled:opacity-50"
                      >
                        <option value="">Choose a time slot</option>
                        {timeSlots.map((slot) => (
                          <option key={slot} value={slot} disabled={bookedSlots.includes(slot)}>
                            {slot} {bookedSlots.includes(slot) ? '(Fully booked)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <GlowButton
                      onClick={handleBook}
                      disabled={booking || !selectedDate || !selectedTime}
                      variant="primary"
                      className="flex-1"
                    >
                      {booking ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Booking...
                        </span>
                      ) : (
                        'Confirm Booking'
                      )}
                    </GlowButton>
                    <GlowButton
                      onClick={() => {
                        setSelectedHospitalToBook(null);
                        setSelectedDate('');
                        setSelectedTime('');
                      }}
                      variant="outline"
                    >
                      Cancel
                    </GlowButton>
                  </div>
                </GlassCard>
              )}

              {/* Upcoming Appointments */}
              {upcomingAppointments.length > 0 ? (
                <div>
                  <h3 className="text-2xl font-bold text-white mb-4">Upcoming Appointments</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {upcomingAppointments.map((apt) => (
                      <motion.div
                        key={apt._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <GlassCard className="p-5 flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-2">
                              {apt.hospitalId?.name || 'Loading...'}
                            </h4>
                            <div className="space-y-1 text-sm text-gray-400">
                              <div className="flex items-center gap-2">
                                <Calendar size={16} />
                                {new Date(apt.date).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock size={16} />
                                {apt.timeSlot}
                              </div>
                              {apt.hospitalId?.address && (
                                <div className="flex items-center gap-2">
                                  <MapPin size={16} />
                                  {apt.hospitalId.address}
                                </div>
                              )}
                            </div>
                          </div>
                          <GlowButton
                            onClick={() => handleCancel(apt._id)}
                            variant="outline"
                            size="sm"
                          >
                            Cancel
                          </GlowButton>
                        </GlassCard>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <GlassCard className="p-8 text-center">
                  <Calendar size={48} className="mx-auto text-gray-600 mb-4" />
                  <h4 className="text-lg font-semibold text-gray-300 mb-2">No Upcoming Appointments</h4>
                  <p className="text-gray-400 mb-4">Click on "Smart Recommendations" to book one now</p>
                  <GlowButton
                    onClick={() => setActiveTab('recommendations')}
                    variant="primary"
                  >
                    View Recommendations
                  </GlowButton>
                </GlassCard>
              )}

              {/* Past Appointments */}
              {pastAppointments.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-300 mb-4">Past Appointments</h3>
                  <div className="space-y-2">
                    {pastAppointments.map((apt) => (
                      <GlassCard key={apt._id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-300">{apt.hospitalId?.name}</h4>
                            <p className="text-xs text-gray-500">
                              {new Date(apt.date).toLocaleDateString()} at {apt.timeSlot}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded text-xs font-semibold ${
                              apt.status === 'Completed'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollReveal>
        )}
      </div>
    </div>
  );
}
