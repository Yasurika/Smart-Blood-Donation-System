import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/db';
import BloodRequest from '@/lib/models/BloodRequest';
import Notification from '@/lib/models/Notification';
import User from '@/lib/models/User';
import logger from '@/lib/logger';
import { apiSuccess, apiError, rateLimit } from '@/lib/api-utils';

// POST /api/blood-requests/[id]/respond - Donor responds to a blood request
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: 'blood-request-respond' });
    if (rateLimited) return rateLimited;

    try {
        const session = await auth();
        if (!session?.user?.id) {
            return apiError('Authentication required', 401);
        }
        if (session.user.role !== 'donor') {
            return apiError('Only donors can respond to blood requests', 403);
        }

        const { id } = await params;

        await dbConnect();

        const bloodRequest = await BloodRequest.findById(id).populate('hospitalId', 'name address phone');
        if (!bloodRequest) {
            return apiError('Blood request not found', 404);
        }

        if (bloodRequest.status !== 'Active') {
            return apiError('This request is no longer active', 400);
        }

        // Check if donor already responded
        const donorId = session.user.id;
        if (bloodRequest.respondedDonors.some((d: { toString(): string }) => d.toString() === donorId)) {
            return apiError('You have already responded to this request', 409);
        }

        // Verify donor exists and is eligible
        const donor = await User.findById(donorId);
        if (!donor) return apiError('Donor not found', 404);

        // Check basic eligibility (90-day gap)
        if (donor.lastDonationDate) {
            const daysSinceLast = Math.floor((Date.now() - new Date(donor.lastDonationDate).getTime()) / (1000 * 3600 * 24));
            if (daysSinceLast < 56) {
                return apiError(`You donated ${daysSinceLast} days ago. Minimum 56-day gap required.`, 400);
            }
        }

        // Add donor to respondedDonors
        await BloodRequest.updateOne(
            { _id: id },
            { $addToSet: { respondedDonors: donorId } }
        );

        // Notify the hospital
        const hospitalName = (bloodRequest.hospitalId as { name: string })?.name || 'Hospital';
        await Notification.create({
            userId: bloodRequest.hospitalId._id || bloodRequest.hospitalId,
            type: 'System',
            title: 'Donor Response Received',
            message: `${donor.name} (${donor.bloodType}) has volunteered to donate for your ${bloodRequest.bloodType} blood request.`,
            link: '/dashboard/requests',
            priority: 'high',
        });

        // Confirm notification to donor
        await Notification.create({
            userId: donorId,
            type: 'System',
            title: 'Response Confirmed',
            message: `You have volunteered to donate ${bloodRequest.bloodType} blood to ${hospitalName}. The hospital will contact you soon.`,
            link: '/dashboard/requests',
            priority: 'medium',
        });

        logger.info('Donor responded to blood request', { requestId: id, donorId, bloodType: bloodRequest.bloodType });

        return apiSuccess({
            message: 'Your response has been recorded. The hospital will contact you shortly.',
            hospitalName,
            hospitalAddress: (bloodRequest.hospitalId as { address: string })?.address,
            hospitalPhone: (bloodRequest.hospitalId as { phone: string })?.phone,
        });
    } catch (error) {
        logger.error('Failed to respond to blood request', { error: (error as Error).message });
        return apiError('Failed to process response', 500);
    }
}
