import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import AuditLog from '@/lib/models/AuditLog';
import logger from '@/lib/logger';
import {
    apiSuccess, apiError, rateLimit,
    requireAuth, getPaginationParams, paginationMeta
} from '@/lib/api-utils';

// GET all audit logs (admin-only, paginated)
export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'audit-logs' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth(['admin']);
    if ('error' in authResult) return authResult.error;

    try {
        await dbConnect();

        const { page, limit, skip } = getPaginationParams(request, 50, 200);
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const entity = searchParams.get('entity');
        const action = searchParams.get('action');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const filter: Record<string, unknown> = {};
        if (userId) filter.userId = userId;
        if (entity) filter.entity = entity;
        if (action) filter.action = { $regex: action, $options: 'i' };
        if (from || to) {
            filter.timestamp = {};
            if (from) (filter.timestamp as Record<string, Date>).$gte = new Date(from);
            if (to) (filter.timestamp as Record<string, Date>).$lte = new Date(to);
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .populate('userId', 'name email')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit),
            AuditLog.countDocuments(filter),
        ]);

        return apiSuccess(logs, 200, paginationMeta(page, limit, total));
    } catch (error) {
        logger.error('Failed to fetch audit logs', { error: (error as Error).message });
        return apiError('Failed to fetch audit logs', 500);
    }
}

// Audit logs are system-generated only — no public POST endpoint
