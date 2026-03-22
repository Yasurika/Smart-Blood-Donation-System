import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import logger from '@/lib/logger';
import { RegisterSchema } from '@/lib/validations';
import { apiSuccess, apiError, validateBody, rateLimit, getClientIp } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
    // Rate limit: 5 registrations per IP per 15 minutes
    const rateLimited = rateLimit(req, { windowMs: 900_000, max: 5, keyPrefix: 'register' });
    if (rateLimited) return rateLimited;

    try {
        const body = await req.json();
        const validation = validateBody(RegisterSchema, body);
        if ('error' in validation) return validation.error;

        const { name, email, nicNumber, password, bloodType, weight, address, phone, dateOfBirth, gender, district } = validation.data;

        await dbConnect();

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return apiError('An account with this email already exists', 409);
        }

        const normalizedNic = nicNumber.toUpperCase();
        const existingNic = await User.findOne({ nicNumber: normalizedNic, isActive: true });
        if (existingNic) {
            return apiError('An account with this NIC already exists', 409);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new user
        const newUser = await User.create({
            name,
            email,
            nicNumber: normalizedNic,
            password: hashedPassword,
            bloodType,
            weight,
            address,
            phone,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            gender,
            district,
            role: 'donor',
        });

        logger.info('New donor registered', { userId: newUser._id, email, ip: getClientIp(req) });

        return apiSuccess(
            { message: 'User registered successfully', userId: newUser._id },
            201
        );
    } catch (error) {
        logger.error('Registration error', { error: (error as Error).message });
        return apiError('Registration failed. Please try again.', 500);
    }
}
