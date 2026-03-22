import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import Hospital from '@/lib/models/Hospital';
import BloodStock from '@/lib/models/BloodStock';
import logger from '@/lib/logger';
import { CreateHospitalSchema } from '@/lib/validations';
import {
    apiSuccess, apiError, validateBody, rateLimit,
    requireAuth, getPaginationParams, paginationMeta, getClientIp, createAuditEntry
} from '@/lib/api-utils';
import { auth } from '@/auth';

// GET all hospitals (paginated)
export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'hospitals-list' });
    if (rateLimited) return rateLimited;

    try {
        await dbConnect();

        const { page, limit, skip } = getPaginationParams(request);
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const filter: Record<string, unknown> = { isActive: true };
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
            ];
        }

        const district = searchParams.get('district');
        if (district) filter.district = district;

        const bloodType = searchParams.get('bloodType');
        if (bloodType) {
            const hospitalIdsWithStock = await BloodStock.distinct('hospitalId', {
                bloodType,
                status: 'Available',
                units: { $gt: 0 },
            });

            filter._id = {
                $in: hospitalIdsWithStock.length > 0 ? hospitalIdsWithStock : [null],
            };
        }

        const populate = searchParams.get('populate');

        if (populate === 'bloodStocks') {
            const session = await auth();
            const role = session?.user?.role;
            if (role !== 'hospital' && role !== 'admin') {
                return apiError('Insufficient permissions', 403);
            }
        }

        // Geospatial: nearest hospitals
        const lat = searchParams.get('lat');
        const lng = searchParams.get('lng');
        const maxDistance = Number(searchParams.get('maxDistance')) || 50000; // 50km default

        if (lat && lng) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);

            if (!isNaN(latitude) && !isNaN(longitude)) {
                const nearbyHospitals = await Hospital.find({
                    ...filter,
                    location: {
                        $near: {
                            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                            $maxDistance: maxDistance,
                        },
                    },
                }).select('-password -failedLoginAttempts -lockedUntil').limit(limit);

                // Calculate distances
                const hospitalsWithDistance = nearbyHospitals.map(h => {
                    const hObj = h.toObject();
                    const [hLng, hLat] = h.location?.coordinates || [0, 0];
                    const R = 6371;
                    const dLat = ((hLat - latitude) * Math.PI) / 180;
                    const dLon = ((hLng - longitude) * Math.PI) / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos((latitude * Math.PI) / 180) * Math.cos((hLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
                    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    return { ...hObj, distance: Math.round(distance * 10) / 10 };
                });

                return apiSuccess(hospitalsWithDistance);
            }
        }

        const [hospitals, total] = await Promise.all([
            Hospital.find(filter).select('-password -failedLoginAttempts -lockedUntil').sort({ createdAt: -1 }).skip(skip).limit(limit),
            Hospital.countDocuments(filter),
        ]);

        // Populate blood stocks if requested
        let hospitalsData = hospitals;
        if (populate === 'bloodStocks') {
            hospitalsData = await Promise.all(
                hospitals.map(async (hospital: any) => {
                    const hObj = hospital.toObject();
                    const stocks = await BloodStock.aggregate([
                        {
                            $match: {
                                hospitalId: hospital._id,
                                status: 'Available',
                            }
                        },
                        {
                            $group: {
                                _id: '$bloodType',
                                totalUnits: { $sum: '$units' },
                            },
                        },
                    ]);

                    const bloodStocks: Record<string, number> = {};
                    stocks.forEach((stock: any) => {
                        bloodStocks[stock._id] = stock.totalUnits;
                    });

                    return {
                        ...hObj,
                        bloodStocks,
                    };
                })
            );
        }

        return apiSuccess(hospitalsData, 200, paginationMeta(page, limit, total));
    } catch (error) {
        logger.error('Failed to fetch hospitals', { error: (error as Error).message });
        return apiError('Failed to fetch hospitals', 500);
    }
}

// CREATE new hospital (admin-only)
export async function POST(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: 'hospitals-create' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth(['admin']);
    if ('error' in authResult) return authResult.error;

    try {
        const body = await request.json();
        const validation = validateBody(CreateHospitalSchema, body);
        if ('error' in validation) return validation.error;

        await dbConnect();

        // Check duplicate email
        const existing = await Hospital.findOne({ email: validation.data.email });
        if (existing) {
            return apiError('A hospital with this email already exists', 409);
        }

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(validation.data.password, 12);

        const hospital = await Hospital.create({
            ...validation.data,
            password: hashedPassword,
        });

        const hospitalObj = hospital.toObject();
        delete hospitalObj.password;

        await createAuditEntry(
            authResult.session.user!.id, 'CREATE', 'Hospital',
            hospital._id.toString(), `Created hospital: ${hospital.name}`, getClientIp(request)
        );

        logger.info('Hospital created', { hospitalId: hospital._id, name: hospital.name });
        return apiSuccess(hospitalObj, 201);
    } catch (error) {
        logger.error('Failed to create hospital', { error: (error as Error).message });
        return apiError('Failed to create hospital', 500);
    }
}
