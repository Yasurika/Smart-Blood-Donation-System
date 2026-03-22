import { NextRequest } from 'next/server';
import { getSmartRecommendations } from '@/lib/appointment-recommendation';
import { apiSuccess, apiError, requireAuth, rateLimit } from '@/lib/api-utils';
import logger from '@/lib/logger';

/**
 * GET /api/appointments/recommendations
 * Returns smart appointment recommendations based on:
 * - Donor eligibility (90-day waiting period)
 * - Hospital proximity
 * - Slot availability
 * - Hospital capacity & reputation
 * 
 * Query params:
 * - lat, lng: User location (optional, for distance calculation)
 */
export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'appointment-recommendations' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.error;

    try {
        const { searchParams } = new URL(request.url);
        const lat = searchParams.get('lat');
        const lng = searchParams.get('lng');

        const userLocation = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined;

        const recommendations = await getSmartRecommendations(
            authResult.session.user!.id,
            userLocation
        );

        logger.info('Generated appointment recommendations', {
            userId: authResult.session.user!.id,
            availableCount: recommendations.recommendations.length,
        });

        return apiSuccess(recommendations);
    } catch (error) {
        logger.error('Failed to generate recommendations', { error: (error as Error).message });
        return apiError('Failed to generate recommendations', 500);
    }
}
