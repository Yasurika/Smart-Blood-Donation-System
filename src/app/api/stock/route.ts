import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import BloodStock from '@/lib/models/BloodStock';
import logger from '@/lib/logger';
import { CreateBloodStockSchema } from '@/lib/validations';
import {
    apiSuccess, apiError, validateBody, rateLimit,
    requireAuth, getPaginationParams, paginationMeta, createAuditEntry, getClientIp
} from '@/lib/api-utils';

export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'stock-list' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth(['hospital', 'admin']);
    if ('error' in authResult) return authResult.error;

    try {
        await dbConnect();

        const { page, limit, skip } = getPaginationParams(request);
        const { searchParams } = new URL(request.url);
        const hospitalId = searchParams.get('hospitalId');
        const bloodType = searchParams.get('bloodType');
        const status = searchParams.get('status');
        const expiringSoon = searchParams.get('expiringSoon'); // days

        const filter: Record<string, unknown> = {};
        if (hospitalId) filter.hospitalId = hospitalId;
        if (bloodType) filter.bloodType = bloodType;
        if (status) filter.status = status;

        // Filter for expiring stock (within N days)
        if (expiringSoon) {
            const days = parseInt(expiringSoon);
            if (!isNaN(days) && days > 0) {
                filter.expiryDate = {
                    $gte: new Date(),
                    $lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
                };
                filter.status = 'Available';
            }
        }

        const [stock, total] = await Promise.all([
            BloodStock.find(filter)
                .populate('hospitalId', 'name address')
                .populate('donorId', 'name bloodType')
                .sort({ expiryDate: 1 })
                .skip(skip)
                .limit(limit),
            BloodStock.countDocuments(filter),
        ]);

        // Also return aggregation summary
        const summaryArray = await BloodStock.aggregate([
            { $match: { status: 'Available', ...(hospitalId ? { hospitalId } : {}) } },
            {
                $group: {
                    _id: '$bloodType',
                    totalUnits: { $sum: '$units' },
                    count: { $sum: 1 },
                    nearestExpiry: { $min: '$expiryDate' },
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Convert array to object keyed by blood type
        const summary: Record<string, { totalUnits: number; count: number; nearestExpiry?: Date }> = {};
        summaryArray.forEach((item: any) => {
            summary[item._id] = {
                totalUnits: item.totalUnits,
                count: item.count,
                nearestExpiry: item.nearestExpiry,
            };
        });

        return apiSuccess({ stock, summary }, 200, paginationMeta(page, limit, total));
    } catch (error) {
        logger.error('Failed to fetch stock', { error: (error as Error).message });
        return apiError('Failed to fetch stock', 500);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 20, keyPrefix: 'stock-create' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth(['hospital', 'admin']);
    if ('error' in authResult) return authResult.error;

    try {
        const body = await request.json();
        const validation = validateBody(CreateBloodStockSchema, body);
        if ('error' in validation) return validation.error;

        await dbConnect();

        // Check for duplicate barcode
        const existingBarcode = await BloodStock.findOne({ barcode: validation.data.barcode });
        if (existingBarcode) {
            return apiError('A stock entry with this barcode already exists', 409);
        }

        const stock = await BloodStock.create(validation.data);

        await createAuditEntry(
            authResult.session.user!.id, 'CREATE', 'BloodStock',
            stock._id.toString(),
            `Added ${validation.data.units} units of ${validation.data.bloodType} blood (barcode: ${validation.data.barcode})`,
            getClientIp(request)
        );

        logger.info('Blood stock added', { stockId: stock._id, bloodType: validation.data.bloodType, units: validation.data.units });
        return apiSuccess(stock, 201);
    } catch (error) {
        logger.error('Failed to create stock', { error: (error as Error).message });
        return apiError('Failed to add stock', 500);
    }
}

export async function PATCH(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 30, keyPrefix: 'stock-update' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth(['hospital', 'admin']);
    if ('error' in authResult) return authResult.error;

    try {
        const body = await request.json();
        const { bloodType, units } = body;

        if (!bloodType || units === undefined) {
            return apiError('bloodType and units are required', 400);
        }

        if (typeof units !== 'number' || units < 0) {
            return apiError('units must be a non-negative number', 400);
        }

        await dbConnect();

        // Find all available stock entries for this blood type, sorted by expiry date (latest first)
        const existingStocks = await BloodStock.find({ 
            bloodType, 
            status: 'Available' 
        }).sort({ expiryDate: -1 });

        if (existingStocks.length === 0) {
            return apiError('No stock entry found for this blood type. Please create one first.', 404);
        }

        // Update the entry with latest expiry date
        const stock = await BloodStock.findByIdAndUpdate(
            existingStocks[0]._id,
            { units },
            { new: true }
        );

        if (!stock) {
            return apiError('Failed to update stock', 500);
        }

        await createAuditEntry(
            authResult.session.user!.id, 'UPDATE', 'BloodStock',
            stock._id.toString(),
            `Updated ${bloodType} stock to ${units} units`,
            getClientIp(request)
        );

        logger.info('Blood stock updated', { stockId: stock._id, bloodType, units });
        return apiSuccess(stock, 200);
    } catch (error) {
        logger.error('Failed to update stock', { error: (error as Error).message });
        return apiError('Failed to update stock', 500);
    }
}
