import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Hospital from '@/lib/models/Hospital';
import logger from '@/lib/logger';
import { apiSuccess, apiError, requireAuth } from '@/lib/api-utils';

// GET user/hospital locations (public list for mapping)
export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'donors', 'hospitals', or 'all'
        const bloodType = searchParams.get('bloodType');

        const locations: any[] = [];

        if (!type || type === 'donors' || type === 'all') {
            const donorFilter: Record<string, unknown> = { isActive: true };
            if (bloodType) donorFilter.bloodType = bloodType;

            const donors = await User.find(donorFilter)
                .select('name location bloodType district')
                .lean();

            locations.push(
                ...donors.map(donor => ({
                    _id: donor._id.toString(),
                    name: donor.name,
                    type: 'donor',
                    location: donor.location,
                    bloodType: donor.bloodType,
                    district: donor.district,
                }))
            );
        }

        if (!type || type === 'hospitals' || type === 'all') {
            const hospitals = await Hospital.find({ isActive: true })
                .select('name location district phone')
                .lean();

            locations.push(
                ...hospitals.map(hospital => ({
                    _id: hospital._id.toString(),
                    name: hospital.name,
                    type: 'hospital',
                    location: hospital.location,
                    district: hospital.district,
                    phone: hospital.phone,
                }))
            );
        }

        return apiSuccess(locations, 200);
    } catch (error) {
        logger.error('Failed to fetch locations', { error: (error as Error).message });
        return apiError('Failed to fetch locations', 500);
    }
}

// PUT update user location
export async function PUT(request: NextRequest) {
    try {
        const auth = await requireAuth();
        if (auth.error) {
            return auth.error;
        }

        const user = auth.session?.user;
        if (!user?.id) {
            return apiError('Unauthorized', 401);
        }

        await dbConnect();
        const body = await request.json();
        const { latitude, longitude } = body;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return apiError('Invalid coordinates', 400);
        }

        let updated;
        
        if (user.role === 'hospital') {
            updated = await Hospital.findByIdAndUpdate(
                user.id,
                {
                    location: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                },
                { new: true, runValidators: true }
            ).select('-password -failedLoginAttempts -lockedUntil');
        } else {
            updated = await User.findByIdAndUpdate(
                user.id,
                {
                    location: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                },
                { new: true, runValidators: true }
            ).select('-password -failedLoginAttempts -lockedUntil');
        }

        if (!updated) {
            return apiError('User/Hospital not found', 404);
        }

        return apiSuccess(
            {
                message: 'Location updated successfully',
                location: updated.location,
            },
            200
        );
    } catch (error) {
        logger.error('Failed to update location', { error: (error as Error).message });
        return apiError('Failed to update location', 500);
    }
}
