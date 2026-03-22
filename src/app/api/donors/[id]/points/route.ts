import { NextRequest } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import {
    apiSuccess,
    apiError,
    validateBody,
    requireAuth,
    createAuditEntry,
    getClientIp,
    rateLimit,
} from '@/lib/api-utils';

const AwardPointsSchema = z.object({
    points: z.coerce.number().int().min(1).max(1000),
    markDonation: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 30, keyPrefix: 'donor-points-award' });
    if (rateLimited) return rateLimited;

    try {
        const authResult = await requireAuth(['hospital', 'admin']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const validation = validateBody(AwardPointsSchema, body);
        if ('error' in validation) return validation.error;

        const update: {
            $inc: { xp: number; totalDonations?: number };
            $set?: { lastDonationDate: Date };
        } = {
            $inc: { xp: validation.data.points },
        };

        if (validation.data.markDonation) {
            update.$inc.totalDonations = 1;
            update.$set = { lastDonationDate: new Date() };
        }

        const donor = await User.findOneAndUpdate(
            { _id: id, role: 'donor', isActive: true },
            update,
            { new: true, runValidators: true }
        ).select('-password -failedLoginAttempts -lockedUntil');

        if (!donor) return apiError('Donor not found', 404);

        const details = validation.data.markDonation
            ? `Awarded ${validation.data.points} XP and recorded donation for ${donor.email}`
            : `Awarded ${validation.data.points} XP to ${donor.email}`;

        await createAuditEntry(
            authResult.session.user.id,
            validation.data.markDonation ? 'DONOR_DONATION_RECORDED' : 'DONOR_POINTS_AWARDED',
            'User',
            id,
            details,
            getClientIp(request)
        );

        return apiSuccess(donor, 200);
    } catch (error) {
        return apiError((error as Error).message || 'Failed to award donor points', 500);
    }
}
