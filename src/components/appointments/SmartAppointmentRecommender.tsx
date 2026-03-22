'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Star, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';

interface Score {
  proximity: number;
  availability: number;
  capacity: number;
  hospitalReputation: number;
}

interface Metrics {
  daysUntilAvailable: number;
  availableCount: number;
  distanceKm?: number;
  operatingHours?: string;
}

interface Recommendation {
  hospitalId: string;
  hospitalName: string;
  address: string;
  distance?: number;
  availableSlots: string[];
  recommendationRank: number;
  scores: Score;
  metrics: Metrics;
  reasons: string[];
}

interface SmartRecommenderProps {
  userLocation?: { lat: number; lng: number };
  onSelectHospital?: (hospitalId: string, date: string, timeSlot: string) => void;
}

const ScoreBadge: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const getColor = (val: number) => {
    if (val >= 80) return 'from-emerald-500 to-green-600';
    if (val >= 60) return 'from-blue-500 to-cyan-600';
    return 'from-yellow-500 to-orange-600';
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-gray-700 dark:text-gray-600"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${(value / 100) * 176} 176`}
            className={`bg-gradient-to-r ${getColor(value)} text-transparent`}
            style={{
              backgroundClip: 'border-box',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{Math.round(value)}</span>
        </div>
      </div>
      <span className="text-xs text-gray-400 text-center">{label}</span>
    </div>
  );
};

const RecommendationCard: React.FC<{
  rec: Recommendation;
  index: number;
  isTopPick: boolean;
  onSelect: (hospitalId: string) => void;
}> = ({ rec, index, isTopPick, onSelect }) => {
  const averageScore = Math.round(
    (rec.scores.proximity +
      rec.scores.availability +
      rec.scores.capacity +
      rec.scores.hospitalReputation) /
      4
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <GlassCard className={`p-6 relative overflow-hidden ${isTopPick ? 'ring-2 ring-green-500' : ''}`}>
        {isTopPick && (
          <motion.div
            className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-bl-lg"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            ⭐ BEST OPTION
          </motion.div>
        )}

        {/* Header */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white mb-2">{rec.hospitalName}</h3>
          <div className="flex items-start gap-2 text-gray-300 text-sm mb-3">
            <MapPin size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p>{rec.address}</p>
              {rec.distance && <p className="text-gray-400">{rec.distance.toFixed(1)} km away</p>}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-5 pb-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-400" />
            <div>
              <p className="text-xs text-gray-400">Available in</p>
              <p className="text-sm font-semibold text-white">{rec.metrics.daysUntilAvailable} days</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-purple-400" />
            <div>
              <p className="text-xs text-gray-400">Hours</p>
              <p className="text-sm font-semibold text-white">{rec.metrics.operatingHours}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" />
            <div>
              <p className="text-xs text-gray-400">Available slots</p>
              <p className="text-sm font-semibold text-white">{rec.metrics.availableCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Star size={16} className="text-yellow-400" />
            <div>
              <p className="text-xs text-gray-400">Hospital score</p>
              <p className="text-sm font-semibold text-white">{averageScore}%</p>
            </div>
          </div>
        </div>

        {/* Detailed Scores */}
        <div className="grid grid-cols-4 gap-4 mb-5 pb-5 border-b border-gray-700">
          <ScoreBadge label="Proximity" value={rec.scores.proximity} />
          <ScoreBadge label="Availability" value={rec.scores.availability} />
          <ScoreBadge label="Capacity" value={rec.scores.capacity} />
          <ScoreBadge label="Reputation" value={rec.scores.hospitalReputation} />
        </div>

        {/* Reasons */}
        <div className="mb-5">
          <p className="text-xs text-gray-400 mb-2 font-semibold">Why recommended:</p>
          <div className="flex flex-wrap gap-2">
            {rec.reasons.map((reason, idx) => (
              <motion.span
                key={idx}
                className="text-xs bg-gray-800 text-gray-200 px-2.5 py-1 rounded-full"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + idx * 0.05 }}
              >
                {reason}
              </motion.span>
            ))}
          </div>
        </div>

        {/* Available Slots Preview */}
        <div className="mb-5 pb-5 border-b border-gray-700">
          <p className="text-xs text-gray-400 mb-2 font-semibold">Available time slots:</p>
          <div className="grid grid-cols-4 gap-2">
            {rec.availableSlots.slice(0, 8).map((slot) => (
              <div
                key={slot}
                className="text-xs bg-gray-900 hover:bg-gray-800 text-center py-1.5 px-2 rounded border border-gray-700 cursor-pointer transition"
              >
                {slot}
              </div>
            ))}
            {rec.availableSlots.length > 8 && (
              <div className="text-xs text-gray-400 py-1.5 px-2 text-center">
                +{rec.availableSlots.length - 8} more
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <GlowButton
          onClick={() => onSelect(rec.hospitalId)}
          className="w-full"
          variant={isTopPick ? 'primary' : 'secondary'}
        >
          {isTopPick ? 'Book Best Option' : 'Select Hospital'}
        </GlowButton>
      </GlassCard>
    </motion.div>
  );
};

export default function SmartAppointmentRecommender({ userLocation, onSelectHospital }: SmartRecommenderProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eligible, setEligible] = useState(true);
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const params = new URLSearchParams();
        if (userLocation) {
          params.append('lat', userLocation.lat.toString());
          params.append('lng', userLocation.lng.toString());
        }

        const res = await fetch(`/api/appointments/recommendations?${params}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load recommendations');
          return;
        }

        setRecommendations(data.data.recommendations || []);
        setEligible(data.data.eligibility.eligible);
        if (!data.data.eligibility.eligible) {
          setEligibilityMessage(data.data.eligibility.message);
        }
      } catch (err) {
        setError('Failed to load recommendations');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [userLocation]);

  if (loading) {
    return (
      <GlassCard className="p-8">
        <div className="flex items-center justify-center gap-3">
          <motion.div
            className="w-3 h-3 rounded-full bg-blue-500"
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
          <p className="text-gray-300">Analyzing best appointment options...</p>
        </div>
      </GlassCard>
    );
  }

  if (!eligible) {
    return (
      <GlassCard className="p-6 border-l-4 border-yellow-500">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Donation Eligibility</h3>
            <p className="text-gray-300">{eligibilityMessage}</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard className="p-6 border-l-4 border-red-500">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-500" size={20} />
          <p className="text-gray-300">{error}</p>
        </div>
      </GlassCard>
    );
  }

  if (recommendations.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-gray-400">No hospitals with available slots found. Try adjusting your location.</p>
      </GlassCard>
    );
  }

  const bestOption = recommendations[0];
  const goodOptions = recommendations.filter((r) => r.recommendationRank === 2);
  const alternatives = recommendations.filter((r) => r.recommendationRank === 3);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-emerald-500" size={24} />
            <div>
              <p className="text-xs text-gray-400">Best Option</p>
              <p className="text-lg font-bold text-white">{bestOption.hospitalName}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-blue-500" size={24} />
            <div>
              <p className="text-xs text-gray-400">Good Alternatives</p>
              <p className="text-lg font-bold text-white">{goodOptions.length} options</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <MapPin className="text-purple-500" size={24} />
            <div>
              <p className="text-xs text-gray-400">Nearby Options</p>
              <p className="text-lg font-bold text-white">{alternatives.length} more</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Best Option */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">🌟 Recommended for You</h2>
        <RecommendationCard
          rec={bestOption}
          index={0}
          isTopPick={true}
          onSelect={(hospitalId) => onSelectHospital?.(hospitalId, '', bestOption.availableSlots[0] || '')}
        />
      </div>

      {/* Good Options */}
      {goodOptions.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">✓ Also Great</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {goodOptions.map((rec, idx) => (
              <RecommendationCard
                key={rec.hospitalId}
                rec={rec}
                index={idx + 1}
                isTopPick={false}
                onSelect={(hospitalId) => onSelectHospital?.(hospitalId, '', rec.availableSlots[0] || '')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">📍 More Options</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {alternatives.slice(0, 3).map((rec, idx) => (
              <RecommendationCard
                key={rec.hospitalId}
                rec={rec}
                index={idx + goodOptions.length + 2}
                isTopPick={false}
                onSelect={(hospitalId) => onSelectHospital?.(hospitalId, '', rec.availableSlots[0] || '')}
              />
            ))}
          </div>
          {alternatives.length > 3 && (
            <p className="text-center text-gray-400 text-sm mt-4">+{alternatives.length - 3} more options available</p>
          )}
        </div>
      )}
    </div>
  );
}
