import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Campaign from '@/lib/models/Campaign';
import { requireAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const campaign = await Campaign.findById(id).populate('organizerId', 'name').populate('rsvpList', 'name bloodType');
        if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: campaign }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const body = await request.json();
        const isRsvpRequest = body?.rsvp === true;

        if (isRsvpRequest) {
            const authResult = await requireAuth();
            if ('error' in authResult) return authResult.error;

            await dbConnect();
            const { id } = await params;
            const campaign = await Campaign.findByIdAndUpdate(
                id,
                { $addToSet: { rsvpList: authResult.session.user!.id } },
                { new: true }
            );

            if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
            return NextResponse.json({ success: true, data: campaign }, { status: 200 });
        }

        const authResult = await requireAuth(['admin', 'hospital']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const { id } = await params;

        const existing = await Campaign.findById(id).select('organizerId');
        if (!existing) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });

        const isAdmin = authResult.session.user!.role === 'admin';
        const isOwner = existing.organizerId?.toString() === authResult.session.user!.id;
        if (!isAdmin && !isOwner) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
        }

        const campaign = await Campaign.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: campaign }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = await requireAuth(['admin', 'hospital']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const { id } = await params;

        const existing = await Campaign.findById(id).select('organizerId');
        if (!existing) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });

        const isAdmin = authResult.session.user!.role === 'admin';
        const isOwner = existing.organizerId?.toString() === authResult.session.user!.id;
        if (!isAdmin && !isOwner) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
        }

        const campaign = await Campaign.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
        return NextResponse.json({ success: true, message: 'Campaign cancelled' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
