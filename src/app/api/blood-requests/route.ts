import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/db';
import BloodRequest from '@/lib/models/BloodRequest';
import Hospital from '@/lib/models/Hospital';
import User from '@/lib/models/User';
import Notification from '@/lib/models/Notification';
import logger from '@/lib/logger';
import { CreateBloodRequestSchema } from '@/lib/validations';
import {
    apiSuccess, apiError, validateBody, rateLimit,
    getPaginationParams, paginationMeta, createAuditEntry, getClientIp
} from '@/lib/api-utils';

// Blood type compatibility matrix for smart donor matching
const COMPATIBLE_DONORS: Record<string, string[]> = {
    'O-': ['O-'],
    'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'],
    'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'],
    'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'blood-requests-list' });
    if (rateLimited) return rateLimited;

    try {
        await dbConnect();

        const { page, limit, skip } = getPaginationParams(request);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'Active';
        const bloodType = searchParams.get('bloodType');
        const urgency = searchParams.get('urgency');
        const hospitalId = searchParams.get('hospitalId');

        const filter: Record<string, unknown> = {};
        if (status !== 'all') filter.status = status;
        if (bloodType) filter.bloodType = bloodType;
        if (urgency) filter.urgency = urgency;
        if (hospitalId) filter.hospitalId = hospitalId;

        const [requests, total] = await Promise.all([
            BloodRequest.find(filter)
                .populate('hospitalId', 'name address phone')
                .sort({ urgency: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            BloodRequest.countDocuments(filter),
        ]);

        return apiSuccess(requests, 200, paginationMeta(page, limit, total));
    } catch (error) {
        logger.error('Failed to fetch blood requests', { error: (error as Error).message });
        return apiError('Failed to fetch requests', 500);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: 'blood-requests-create' });
    if (rateLimited) return rateLimited;

    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== 'hospital') {
            return apiError('Only hospitals can create blood requests', 401);
        }

        const body = await request.json();
        const validation = validateBody(CreateBloodRequestSchema, body);
        if ('error' in validation) return validation.error;

        await dbConnect();

        // Get hospital for location data
        const hospital = await Hospital.findById(session.user.id);
        if (!hospital) return apiError('Hospital not found', 404);

        const newRequest = await BloodRequest.create({
            hospitalId: session.user.id,
            ...validation.data,
            status: 'Active',
            location: hospital.location || { type: 'Point', coordinates: [0, 0] },
        });

        // Smart Donor Matching: Notify compatible donors (prioritize nearby)
        const compatibleTypes = COMPATIBLE_DONORS[validation.data.bloodType] || [validation.data.bloodType];

        const baseDonorFilter: Record<string, unknown> = {
            bloodType: { $in: compatibleTypes },
            isActive: true,
            $or: [
                { lastDonationDate: { $exists: false } },
                { lastDonationDate: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
            ],
        };

        // Try geospatial search first if hospital has valid coordinates
        let eligibleDonors: { _id: unknown; name: string }[] = [];
        const hasCoords = hospital.location?.coordinates &&
            hospital.location.coordinates[0] !== 0 && hospital.location.coordinates[1] !== 0;

        if (hasCoords) {
            // Find donors within 50km first, then expand to 200km
            for (const maxDistance of [50000, 200000]) {
                eligibleDonors = await User.find({
                    ...baseDonorFilter,
                    location: {
                        $near: {
                            $geometry: hospital.location,
                            $maxDistance: maxDistance,
                        },
                    },
                }).select('_id name').limit(50);

                if (eligibleDonors.length >= 5) break;
            }
        }

        // Fallback: if geospatial returned few results, supplement with non-geo query
        if (eligibleDonors.length < 5) {
            const existingIds = eligibleDonors.map(d => d._id);
            const moreDonors = await User.find({
                ...baseDonorFilter,
                _id: { $nin: existingIds },
            }).select('_id name').limit(50 - eligibleDonors.length);
            eligibleDonors = [...eligibleDonors, ...moreDonors];
        }

        // Store matched donors
        if (eligibleDonors.length > 0) {
            await BloodRequest.updateOne(
                { _id: newRequest._id },
                { $set: { matchedDonors: eligibleDonors.map(d => d._id) } }
            );

            // Send notifications to matched donors
            const urgencyLabel = validation.data.urgency === 'Critical' ? 'URGENT: ' : '';
            const notifications = eligibleDonors.map(donor => ({
                userId: donor._id,
                type: validation.data.urgency === 'Critical' ? 'Emergency' as const : 'System' as const,
                title: `${urgencyLabel}Blood Needed - ${validation.data.bloodType}`,
                message: `${hospital.name} needs ${validation.data.units} unit(s) of ${validation.data.bloodType} blood. ${validation.data.urgency} priority.`,
                link: `/dashboard/requests`,
                priority: validation.data.urgency === 'Critical' ? 'urgent' as const : 'high' as const,
            }));

            await Notification.insertMany(notifications);
            logger.info('Donor notifications sent', { requestId: newRequest._id, matchedDonors: eligibleDonors.length });
        }

        await createAuditEntry(
            session.user.id, 'CREATE', 'BloodRequest',
            newRequest._id.toString(),
            `Created ${validation.data.urgency} request for ${validation.data.units} units of ${validation.data.bloodType}`,
            getClientIp(request)
        );

        logger.info('Blood request created', { requestId: newRequest._id, bloodType: validation.data.bloodType, urgency: validation.data.urgency });
        return apiSuccess({ request: newRequest, matchedDonors: eligibleDonors.length }, 201);
    } catch (error) {
        logger.error('Failed to create blood request', { error: (error as Error).message });
        return apiError('Failed to create request', 500);
    }
}
