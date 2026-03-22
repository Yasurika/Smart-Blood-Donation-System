import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/lib/models/Notification';
import logger from '@/lib/logger';
import { CreateNotificationSchema } from '@/lib/validations';
import {
    apiSuccess, apiError, validateBody, rateLimit,
    requireAuth, getPaginationParams, paginationMeta
} from '@/lib/api-utils';

export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'notifications-list' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.error;

    try {
        await dbConnect();

        const { page, limit, skip } = getPaginationParams(request, 20);
        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get('unread') === 'true';

        const filter: Record<string, unknown> = { userId: authResult.session.user!.id };
        if (unreadOnly) filter.isRead = false;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Notification.countDocuments(filter),
            Notification.countDocuments({ userId: authResult.session.user!.id, isRead: false }),
        ]);

        return apiSuccess({ notifications, unreadCount }, 200, paginationMeta(page, limit, total));
    } catch (error) {
        logger.error('Failed to fetch notifications', { error: (error as Error).message });
        return apiError('Failed to fetch notifications', 500);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 30, keyPrefix: 'notifications-create' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth(['admin', 'hospital']);
    if ('error' in authResult) return authResult.error;

    try {
        const body = await request.json();
        const validation = validateBody(CreateNotificationSchema, body);
        if ('error' in validation) return validation.error;

        await dbConnect();
        const notification = await Notification.create(validation.data);

        logger.info('Notification created', { notificationId: notification._id, userId: validation.data.userId });
        return apiSuccess(notification, 201);
    } catch (error) {
        logger.error('Failed to create notification', { error: (error as Error).message });
        return apiError('Failed to create notification', 500);
    }
}

// Mark all notifications as read
export async function PATCH(request: NextRequest) {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.error;

    try {
        await dbConnect();
        await Notification.updateMany(
            { userId: authResult.session.user!.id, isRead: false },
            { $set: { isRead: true } }
        );
        return apiSuccess({ message: 'All notifications marked as read' });
    } catch (error) {
        logger.error('Failed to mark notifications as read', { error: (error as Error).message });
        return apiError('Failed to update notifications', 500);
    }
}
