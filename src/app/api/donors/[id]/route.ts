import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { UpdateDonorSchema } from '@/lib/validations';
import {
    apiSuccess,
    apiError,
    validateBody,
    requireAuth,
    createAuditEntry,
    getClientIp,
} from '@/lib/api-utils';

// GET single donor
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Allow donors to view their own profile as well as hospital/admin roles.
        const authResult = await requireAuth(['donor', 'hospital', 'admin']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const { id } = await params;
        const user = await User.findOne({ _id: id, role: 'donor', isActive: true }).select('-password -failedLoginAttempts -lockedUntil');
        if (!user) return apiError('Donor not found', 404);

        return apiSuccess(user, 200);
    } catch (error) {
        return apiError((error as Error).message || 'Failed to fetch donor', 500);
    }
}

// UPDATE donor
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Allow donors to update their own profile as well as hospital/admin roles.
        const authResult = await requireAuth(['donor', 'hospital', 'admin']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const validation = validateBody(UpdateDonorSchema, body);
        if ('error' in validation) return validation.error;

        const updatePayload = { ...validation.data };
        if (updatePayload.nicNumber) {
            updatePayload.nicNumber = updatePayload.nicNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        }

        const user = await User.findOneAndUpdate(
            { _id: id, role: 'donor', isActive: true },
            updatePayload,
            { new: true, runValidators: true }
        ).select('-password -failedLoginAttempts -lockedUntil');

        if (!user) return apiError('Donor not found', 404);

        await createAuditEntry(
            authResult.session.user.id,
            'DONOR_UPDATED',
            'User',
            id,
            `Updated donor profile fields for ${user.email}`,
            getClientIp(request)
        );

        return apiSuccess(user, 200);
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return apiError('NIC number is already used by another donor', 409);
        }
        return apiError((error as Error).message || 'Failed to update donor', 400);
    }
}

// SOFT DELETE donor
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = await requireAuth(['admin']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const { id } = await params;
        const user = await User.findOneAndUpdate({ _id: id, role: 'donor' }, { isActive: false }, { new: true });
        if (!user) return apiError('Donor not found', 404);

        await createAuditEntry(
            authResult.session.user.id,
            'DONOR_DEACTIVATED',
            'User',
            id,
            `Deactivated donor account ${user.email}`,
            getClientIp(request)
        );

        return apiSuccess({ message: 'Donor deactivated' }, 200);
    } catch (error) {
        return apiError((error as Error).message || 'Failed to deactivate donor', 500);
    }
}
