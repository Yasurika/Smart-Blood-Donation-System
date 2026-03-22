import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import Hospital from '@/lib/models/Hospital';
import logger from '@/lib/logger';
import { RegisterHospitalSchema } from '@/lib/validations';
import { apiSuccess, apiError, validateBody, rateLimit, getClientIp } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
    const rateLimited = rateLimit(req, { windowMs: 900_000, max: 5, keyPrefix: 'register-hospital' });
    if (rateLimited) return rateLimited;

    try {
        const body = await req.json();
        const validation = validateBody(RegisterHospitalSchema, body);
        if ('error' in validation) return validation.error;

        const { name, email, password, address, district, phone, contactPerson, facilities, latitude, longitude } = validation.data;

        await dbConnect();

        const existingHospital = await Hospital.findOne({ email });
        if (existingHospital) {
            return apiError('A hospital with this email already exists', 409);
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const location = (latitude !== undefined && longitude !== undefined)
            ? { type: 'Point' as const, coordinates: [longitude, latitude] }
            : { type: 'Point' as const, coordinates: [0, 0] };

        const newHospital = await Hospital.create({
            name,
            email,
            password: hashedPassword,
            address,
            district,
            phone,
            contactPerson,
            facilities,
            location,
            role: 'hospital',
        });

        logger.info('New hospital registered', { hospitalId: newHospital._id, email, ip: getClientIp(req) });

        return apiSuccess(
            { message: 'Hospital registered successfully', hospitalId: newHospital._id },
            201
        );
    } catch (error) {
        logger.error('Hospital registration error', { error: (error as Error).message });
        return apiError('Registration failed. Please try again.', 500);
    }
}
