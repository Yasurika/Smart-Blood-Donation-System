/**
 * Advanced Appointment Recommendation Engine
 * Intelligently suggests the best booking options based on multiple factors
 */

import dbConnect from '@/lib/db';
import Appointment from '@/lib/models/Appointment';
import Hospital from '@/lib/models/Hospital';
import User from '@/lib/models/User';
import logger from '@/lib/logger';

export interface RecommendationScore {
  hospitalId: string;
  hospitalName: string;
  address: string;
  distance?: number;
  availableSlots: string[];
  recommendationRank: number; // 1 = Best, 2 = Good, 3 = Alternative
  scores: {
    proximity: number; // 0-100
    availability: number; // 0-100
    capacity: number; // 0-100
    hospitalReputation: number; // 0-100
  };
  metrics: {
    daysUntilAvailable: number;
    availableCount: number;
    distanceKm?: number;
    operatingHours?: string;
  };
  reasons: string[]; // Why this is recommended
}

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const MIN_DAYS_AHEAD = 1; // Appointments must be at least 1 day from now
const MAX_DAYS_AHEAD = 90; // Max 90 days to book ahead
const SLOTS_PER_TIME = 5; // Max capacity per time slot per hospital
const HAVERSINE_RADIUS_KM = 50; // Search radius

/**
 * Haversine formula to calculate distance between two coordinates
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate proximity score (0-100)
 * Closer hospitals get higher scores
 */
function calculateProximityScore(distance?: number): number {
  if (!distance) return 50; // No location data = medium score
  if (distance > HAVERSINE_RADIUS_KM) return 0;
  // Linear decay: 0km = 100, 50km = 0
  return Math.max(0, 100 - (distance / HAVERSINE_RADIUS_KM) * 100);
}

/**
 * Calculate availability score (0-100)
 * More available slots = higher score
 */
function calculateAvailabilityScore(availableSlots: number, totalSlots: number = TIME_SLOTS.length): number {
  if (totalSlots === 0) return 0;
  return (availableSlots / totalSlots) * 100;
}

/**
 * Calculate capacity score (0-100)
 * Hospitals consistently able to take appointments get higher scores
 */
async function calculateCapacityScore(hospitalId: string): Promise<number> {
  try {
    // Count successful appointments in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const[completed, scheduled] = await Promise.all([
      Appointment.countDocuments({
        hospitalId,
        status: 'Completed',
        completedAt: { $gte: thirtyDaysAgo },
      }),
      Appointment.countDocuments({
        hospitalId,
        status: 'Scheduled',
        date: { $gte: thirtyDaysAgo },
      }),
    ]);

    // Score based on completion rate (completed / (completed + scheduled))
    const total = completed + scheduled;
    if (total === 0) return 70; // Default for new hospitals
    return (completed / total) * 100;
  } catch (error) {
    logger.error('Error calculating capacity score', { error });
    return 60;
  }
}

/**
 * Calculate hospital reputation score based on donor satisfaction, no-shows, etc.
 */
async function calculateHospitalReputation(hospitalId: string): Promise<number> {
  try {
    const hospital = await Hospital.findById(hospitalId).lean();
    if (!hospital) return 50;

    // Factor in ratings and metrics if available
    const rating = (hospital as any).rating || 3.5;
    const noShowRate = (hospital as any).noShowRate || 0;

    // Base score on rating (0-5 → 0-100)
    let score = (rating / 5) * 100;

    // Penalize high no-show rates
    score = score * (1 - Math.min(noShowRate, 0.2) / 0.2);

    return Math.max(0, Math.min(100, score));
  } catch (error) {
    logger.error('Error calculating reputation score', { error });
    return 50;
  }
}

/**
 * Get available time slots for a hospital on a given date
 */
async function getAvailableSlots(
  hospitalId: string,
  date: Date
): Promise<string[]> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const booked = await Appointment.countDocuments({
    hospitalId,
    date: { $gte: dayStart, $lt: dayEnd },
    status: 'Scheduled',
  });

  // Filter out fully booked slots
  const bookedBySlot: Record<string, number> = {};
  const bookedAppointments = await Appointment.find(
    {
      hospitalId,
      date: { $gte: dayStart, $lt: dayEnd },
      status: 'Scheduled',
    },
    { timeSlot: 1 }
  ).lean();

  bookedAppointments.forEach((apt) => {
    bookedBySlot[apt.timeSlot] = (bookedBySlot[apt.timeSlot] || 0) + 1;
  });

  return TIME_SLOTS.filter((slot) => (bookedBySlot[slot] || 0) < SLOTS_PER_TIME);
}

/**
 * Check if donor is eligible to book (90-day waiting period)
 */
async function isDonorEligible(donorId: string): Promise<{
  eligible: boolean;
  lastDonationDate?: Date;
  daysUntilEligible?: number;
}> {
  const lastAppointment = await Appointment.findOne(
    {
      donorId,
      status: 'Completed',
    },
    { completedAt: 1 }
  )
    .sort({ completedAt: -1 })
    .lean();

  if (!lastAppointment || !lastAppointment.completedAt) {
    return { eligible: true }; // Never donated
  }

  const lastDate = new Date(lastAppointment.completedAt);
  const ninetyDaysLater = new Date(lastDate);
  ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);

  const now = new Date();
  const daysUntilEligible = Math.ceil((ninetyDaysLater.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    eligible: daysUntilEligible <= 0,
    lastDonationDate: lastDate,
    daysUntilEligible: Math.max(0, daysUntilEligible),
  };
}

/**
 * Main recommendation engine
 */
export async function getSmartRecommendations(
  donorId: string,
  userLocation?: { lat: number; lng: number }
): Promise<{
  recommendations: RecommendationScore[];
  eligibility: {
    eligible: boolean;
    daysUntilEligible?: number;
    message?: string;
  };
  summary: {
    bestOption: RecommendationScore | null;
    totalEvaluated: number;
    availableHospitals: number;
  };
}> {
  await dbConnect();

  try {
    // Check donor eligibility
    const eligibility = await isDonorEligible(donorId);

    if (!eligibility.eligible) {
      return {
        recommendations: [],
        eligibility: {
          eligible: false,
          daysUntilEligible: eligibility.daysUntilEligible,
          message: `You can donate again in ${eligibility.daysUntilEligible} days (90-day waiting period between donations)`,
        },
        summary: {
          bestOption: null,
          totalEvaluated: 0,
          availableHospitals: 0,
        },
      };
    }

    // Get all hospitals
    let hospitals = await Hospital.find({}, {
      _id: 1,
      name: 1,
      address: 1,
      location: 1,
      operatingHours: 1,
      rating: 1,
      noShowRate: 1,
    }).lean();

    // Filter by proximity if location provided
    if (userLocation) {
      hospitals = hospitals.filter((h: any) => {
        const [lon, lat] = h.location?.coordinates || [0, 0];
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          lat,
          lon
        );
        (h as any).distance = distance;
        return distance <= HAVERSINE_RADIUS_KM;
      });
    }

    // Evaluate each hospital for next 14 days
    const recommendations: RecommendationScore[] = [];
    const now = new Date();

    for (const hospital of hospitals) {
      // Check availability for next 14 days
      const availabilityDays: { [key: string]: string[] } = {};
      let firstAvailableDate: Date | null = null;

      for (let daysAhead = MIN_DAYS_AHEAD; daysAhead <= 14; daysAhead++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + daysAhead);
        checkDate.setHours(0, 0, 0, 0);

        const slots = await getAvailableSlots((hospital as any)._id.toString(), checkDate);

        if (slots.length > 0) {
          const dateKey = checkDate.toISOString().split('T')[0];
          availabilityDays[dateKey] = slots;
          if (!firstAvailableDate) {
            firstAvailableDate = checkDate;
          }
        }
      }

      // Only include hospitals with available slots
      if (!firstAvailableDate || Object.keys(availabilityDays).length === 0) {
        continue;
      }

      // Calculate scores
      const proximityScore = calculateProximityScore((hospital as any).distance);
      const totalAvailableSlots = Object.values(availabilityDays).reduce((sum, slots) => sum + slots.length, 0);
      const availabilityScore = calculateAvailabilityScore(totalAvailableSlots, TIME_SLOTS.length * 14);
      const capacityScore = await calculateCapacityScore((hospital as any)._id.toString());
      const reputationScore = await calculateHospitalReputation((hospital as any)._id.toString());

      // Calculate weighted overall score
      const overallScore =
        proximityScore * 0.25 +
        availabilityScore * 0.25 +
        capacityScore * 0.25 +
        reputationScore * 0.25;

      // Determine ranking tier
      let recommendationRank = 3;
      const reasons: string[] = [];

      if (overallScore >= 75) {
        recommendationRank = 1; // Best
        reasons.push('⭐ Top-rated option');
      } else if (overallScore >= 50) {
        recommendationRank = 2; // Good
        reasons.push('✓ Solid option');
      }

      if (proximityScore >= 80) reasons.push('📍 Very close to you');
      else if (proximityScore >= 50) reasons.push('📍 Reasonably accessible');

      if (availabilityScore >= 75) reasons.push('📅 Many available slots');
      else if (availabilityScore >= 50) reasons.push('📅 Good availability');

      if (capacityScore >= 80) reasons.push('🏥 High completion rate');
      if (reputationScore >= 80) reasons.push('⭐ Highly rated hospital');

      const daysUntilAvailable = Math.ceil(
        (firstAvailableDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      recommendations.push({
        hospitalId: (hospital as any)._id.toString(),
        hospitalName: (hospital as any).name,
        address: (hospital as any).address,
        distance: (hospital as any).distance,
        availableSlots: availabilityDays[firstAvailableDate!.toISOString().split('T')[0]] || [],
        recommendationRank,
        scores: {
          proximity: Math.round(proximityScore),
          availability: Math.round(availabilityScore),
          capacity: Math.round(capacityScore),
          hospitalReputation: Math.round(reputationScore),
        },
        metrics: {
          daysUntilAvailable,
          availableCount: totalAvailableSlots,
          distanceKm: (hospital as any).distance ? Math.round((hospital as any).distance * 10) / 10 : undefined,
          operatingHours: (hospital as any).operatingHours
            ? `${(hospital as any).operatingHours.open}-${(hospital as any).operatingHours.close}`
            : '08:00-16:00',
        },
        reasons,
      });
    }

    // Sort by ranking, then by overall score
    recommendations.sort((a, b) => {
      if (a.recommendationRank !== b.recommendationRank) {
        return a.recommendationRank - b.recommendationRank;
      }
      const scoreA = (a.scores.proximity + a.scores.availability + a.scores.capacity + a.scores.hospitalReputation) / 4;
      const scoreB = (b.scores.proximity + b.scores.availability + b.scores.capacity + b.scores.hospitalReputation) / 4;
      return scoreB - scoreA;
    });

    return {
      recommendations,
      eligibility: {
        eligible: true,
      },
      summary: {
        bestOption: recommendations.length > 0 ? recommendations[0] : null,
        totalEvaluated: hospitals.length,
        availableHospitals: recommendations.length,
      },
    };
  } catch (error) {
    logger.error('Error generating recommendations', { error });
    throw error;
  }
}
