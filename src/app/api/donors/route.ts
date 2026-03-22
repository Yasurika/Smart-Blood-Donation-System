import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import logger from '@/lib/logger';
import { CreateDonorByHospitalSchema } from '@/lib/validations';
import {
    apiSuccess, apiError, validateBody, rateLimit,
    requireAuth, getPaginationParams, paginationMeta, createAuditEntry, getClientIp
} from '@/lib/api-utils';

function buildWalkInEmail(nicNumber: string) {
    const normalized = nicNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `walkin.${normalized}@smartblood.local`;
}

function generateTemporaryPassword() {
    const rand = Math.random().toString(36).slice(2, 8);
    return `TmpDonor#${rand}9A`;
}

// GET all donors (paginated, search, filter)
export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'donors-list' });
    if (rateLimited) return rateLimited;

    try {
        const authResult = await requireAuth(['hospital', 'admin']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();

        const { page, limit, skip } = getPaginationParams(request);
        const { searchParams } = new URL(request.url);
        const bloodType = searchParams.get('bloodType');
        const search = searchParams.get('search');

        const filter: Record<string, unknown> = { isActive: true, role: 'donor' };
        if (bloodType) filter.bloodType = bloodType;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { nicNumber: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
            ];
        }

        const [users, total] = await Promise.all([
            User.find(filter).select('-password -failedLoginAttempts -lockedUntil').sort({ createdAt: -1 }).skip(skip).limit(limit),
            User.countDocuments(filter),
        ]);

        return apiSuccess(users, 200, paginationMeta(page, limit, total));
    } catch (error) {
        logger.error('Failed to fetch donors', { error: (error as Error).message });
        return apiError('Failed to fetch donors', 500);
    }
}

// CREATE new donor (hospital/admin)
export async function POST(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: 'donors-create' });
    if (rateLimited) return rateLimited;

    try {
        const authResult = await requireAuth(['hospital', 'admin']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const body = await request.json();
        const validation = validateBody(CreateDonorByHospitalSchema, body);
        if ('error' in validation) return validation.error;

        const nicNumber = validation.data.nicNumber.toUpperCase();
        const existingNic = await User.findOne({ nicNumber, isActive: true });
        if (existingNic) {
            return apiError('A donor with this NIC already exists', 409);
        }

        const email = validation.data.email || buildWalkInEmail(nicNumber);
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return apiError('A donor with this email already exists', 409);
        }

        const tempPassword = generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        const user = await User.create({
            ...validation.data,
            nicNumber,
            email,
            password: hashedPassword,
            role: 'donor',
            isWalkInRegistered: !validation.data.email,
            registeredByHospital: authResult.session.user.id,
        });

        await createAuditEntry(
            authResult.session.user.id,
            'DONOR_REGISTERED_BY_HOSPITAL',
            'User',
            user._id.toString(),
            `Registered donor with NIC ${nicNumber}`,
            getClientIp(request)
        );

        const userObj = user.toObject();
        delete userObj.password;

        logger.info('Donor created via hospital/admin API', { userId: user._id, by: authResult.session.user.id });
        return apiSuccess(userObj, 201);
    } catch (error) {
        logger.error('Failed to create donor', { error: (error as Error).message });
        return apiError('Failed to create donor', 500);
    }
}
