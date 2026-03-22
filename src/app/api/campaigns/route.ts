import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import Campaign from '@/lib/models/Campaign';
import User from '@/lib/models/User';
import logger from '@/lib/logger';
import { auth } from '@/auth';
import { CreateCampaignSchema } from '@/lib/validations';
import {
    apiSuccess, apiError, validateBody, rateLimit,
    requireAuth, getPaginationParams, paginationMeta, createAuditEntry, getClientIp
} from '@/lib/api-utils';

export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'campaigns-list' });
    if (rateLimited) return rateLimited;

    try {
        await dbConnect();

        const { page, limit, skip } = getPaginationParams(request);
        const { searchParams } = new URL(request.url);
        const upcoming = searchParams.get('upcoming') === 'true';
        const search = searchParams.get('search');

        const filter: Record<string, unknown> = { isActive: true };
        if (upcoming) {
            filter.date = { $gte: new Date() };
        }
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'location.address': { $regex: search, $options: 'i' } },
            ];
        }

        const [campaigns, total, session] = await Promise.all([
            Campaign.find(filter)
                .sort({ date: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Campaign.countDocuments(filter),
            auth(),
        ]);

        const viewerId = session?.user?.id;
        const viewerRole = session?.user?.role;

        const campaignObjects = campaigns as any[];
        const ownCampaigns = campaignObjects.filter((c: any) => {
            const organizerId = c.organizerId?.toString();
            return !!viewerId && organizerId === viewerId;
        });

        const shouldExposeRsvp = viewerRole === 'admin' || ownCampaigns.length > 0;
        if (!shouldExposeRsvp) {
            const sanitized = campaignObjects.map((c: any) => ({ ...c, rsvpDetails: [], canManage: false }));
            return apiSuccess(sanitized, 200, paginationMeta(page, limit, total));
        }

        const campaignsForRsvpDetails = viewerRole === 'admin' ? campaignObjects : ownCampaigns;

        const rsvpIds = new Set<string>();
        campaignsForRsvpDetails.forEach((campaign: any) => {
            (campaign.rsvpList || []).forEach((id: any) => rsvpIds.add(id.toString()));
        });

        const users = rsvpIds.size > 0
            ? await User.find({ _id: { $in: Array.from(rsvpIds) } }).select('name bloodType phone').lean()
            : [];

        const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

        const enriched = campaignObjects.map((campaign: any) => {
            const organizerId = campaign.organizerId?.toString();
            const isOwner = !!viewerId && organizerId === viewerId;
            const canManage = viewerRole === 'admin' || (viewerRole === 'hospital' && isOwner);

            if (!isOwner && viewerRole !== 'admin') {
                return { ...campaign, rsvpDetails: [], canManage };
            }

            const rsvpDetails = (campaign.rsvpList || [])
                .map((id: any) => userMap.get(id.toString()))
                .filter(Boolean)
                .map((u: any) => ({
                    id: u._id.toString(),
                    name: u.name,
                    bloodType: u.bloodType,
                    phone: u.phone,
                }));

            return { ...campaign, rsvpDetails, canManage };
        });

        return apiSuccess(enriched, 200, paginationMeta(page, limit, total));
    } catch (error) {
        logger.error('Failed to fetch campaigns', { error: (error as Error).message });
        return apiError('Failed to fetch campaigns', 500);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: 'campaigns-create' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth(['admin', 'hospital']);
    if ('error' in authResult) return authResult.error;

    try {
        const body = await request.json();
        const validation = validateBody(CreateCampaignSchema, body);
        if ('error' in validation) return validation.error;

        await dbConnect();

        const campaign = await Campaign.create({
            ...validation.data,
            organizerId: authResult.session.user!.id,
        });

        await createAuditEntry(
            authResult.session.user!.id, 'CREATE', 'Campaign',
            campaign._id.toString(),
            `Created campaign: ${validation.data.title}`,
            getClientIp(request)
        );

        logger.info('Campaign created', { campaignId: campaign._id, title: validation.data.title });
        return apiSuccess(campaign, 201);
    } catch (error) {
        logger.error('Failed to create campaign', { error: (error as Error).message });
        return apiError('Failed to create campaign', 500);
    }
}
