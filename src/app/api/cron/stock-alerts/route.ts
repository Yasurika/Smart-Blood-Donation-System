import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import BloodStock from '@/lib/models/BloodStock';
import Hospital from '@/lib/models/Hospital';
import User from '@/lib/models/User';
import Notification from '@/lib/models/Notification';
import logger from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-utils';

// Minimum safe stock levels per blood type (units)
const SAFE_STOCK_THRESHOLD = 10;

// POST /api/cron/stock-alerts — call via scheduled job
export async function POST(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return apiError('Unauthorized', 401);
    }

    try {
        await dbConnect();

        const now = new Date();
        let alertsSent = 0;
        let expiryAlerts = 0;

        // ─── 1. Low Stock Alerts ─────────────────────────────
        // Get hospitals with aggregated stock levels
        const hospitalStock = await BloodStock.aggregate([
            { $match: { status: 'Available' } },
            {
                $group: {
                    _id: { hospitalId: '$hospitalId', bloodType: '$bloodType' },
                    totalUnits: { $sum: '$units' },
                }
            },
            { $match: { totalUnits: { $lt: SAFE_STOCK_THRESHOLD } } },
        ]);

        for (const entry of hospitalStock) {
            const hospital = await Hospital.findById(entry._id.hospitalId).select('name location').lean() as {
                _id: unknown; name: string; location?: { type: string; coordinates: [number, number] };
            } | null;
            if (!hospital) continue;

            const bloodType = entry._id.bloodType;
            const units = entry.totalUnits;

            // Find compatible donors nearby
            const donorFilter: Record<string, unknown> = {
                bloodType,
                isActive: true,
                role: 'donor',
                $or: [
                    { lastDonationDate: { $exists: false } },
                    { lastDonationDate: { $lt: new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000) } },
                ],
            };

            const hasCoords = hospital.location?.coordinates &&
                hospital.location.coordinates[0] !== 0 && hospital.location.coordinates[1] !== 0;

            let donors: { _id: unknown }[];
            if (hasCoords) {
                donors = await User.find({
                    ...donorFilter,
                    location: {
                        $near: {
                            $geometry: hospital.location,
                            $maxDistance: 100000, // 100km
                        },
                    },
                }).select('_id').limit(30).lean();
            } else {
                donors = await User.find(donorFilter).select('_id').limit(30).lean();
            }

            // Deduplicate: skip if similar notification sent in last 3 days
            for (const donor of donors) {
                const recent = await Notification.findOne({
                    userId: donor._id,
                    title: { $regex: `Low Stock.*${bloodType}` },
                    createdAt: { $gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
                });

                if (!recent) {
                    await Notification.create({
                        userId: donor._id,
                        type: 'System',
                        title: `Low Stock Alert: ${bloodType} at ${hospital.name}`,
                        message: `${hospital.name} has only ${units} unit(s) of ${bloodType} blood remaining. Your donation could save lives! Book an appointment now.`,
                        link: '/dashboard/appointments',
                        priority: units <= 3 ? 'urgent' : 'high',
                    });
                    alertsSent++;
                }
            }
        }

        // ─── 2. Expiring Stock Alerts (notify hospitals) ─────
        const expiringStock = await BloodStock.find({
            status: 'Available',
            expiryDate: {
                $gte: now,
                $lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
            },
        }).populate('hospitalId', '_id name').lean() as Array<{
            _id: unknown; hospitalId: { _id: unknown; name: string } | null;
            bloodType: string; units: number; barcode: string; expiryDate: Date;
        }>;

        // Group by hospital
        const hospitalMap = new Map<string, typeof expiringStock>();
        for (const stock of expiringStock) {
            if (!stock.hospitalId) continue;
            const hId = String(stock.hospitalId._id);
            if (!hospitalMap.has(hId)) hospitalMap.set(hId, []);
            hospitalMap.get(hId)!.push(stock);
        }

        for (const [hospitalId, stocks] of hospitalMap) {
            const recent = await Notification.findOne({
                userId: hospitalId,
                title: { $regex: 'Expiring Stock' },
                createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            });

            if (!recent) {
                const details = stocks.map(s => `${s.bloodType} (${s.units}u, expires ${new Date(s.expiryDate).toLocaleDateString()})`).join(', ');
                await Notification.create({
                    userId: hospitalId,
                    type: 'System',
                    title: `Expiring Stock Alert: ${stocks.length} item(s)`,
                    message: `The following stock items expire within 3 days: ${details}. Consider scheduling transfusions or transfers.`,
                    link: '/dashboard/stock/manage',
                    priority: 'urgent',
                });
                expiryAlerts++;
            }
        }

        const summary = { alertsSent, expiryAlerts, lowStockEntries: hospitalStock.length };
        logger.info('Stock alerts processed', summary);
        return apiSuccess(summary);
    } catch (error) {
        logger.error('Stock alert cron failed', { error: (error as Error).message });
        return apiError('Failed to process stock alerts', 500);
    }
}

export async function GET() {
    return apiSuccess({ status: 'Stock alert cron endpoint active', method: 'POST to trigger' });
}
