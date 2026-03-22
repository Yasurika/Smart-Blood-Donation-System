import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BloodRequest from '@/lib/models/BloodRequest';
import { requireAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const bloodRequest = await BloodRequest.findById(id).populate('hospitalId', 'name address phone');
        if (!bloodRequest) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: bloodRequest }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = await requireAuth(['hospital', 'admin']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const existing = await BloodRequest.findById(id).select('hospitalId');
        if (!existing) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });

        const isAdmin = authResult.session.user!.role === 'admin';
        const isOwnerHospital = existing.hospitalId?.toString() === authResult.session.user!.id;

        if (!isAdmin && !isOwnerHospital) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
        }

        const bloodRequest = await BloodRequest.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!bloodRequest) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: bloodRequest }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = await requireAuth(['hospital', 'admin']);
        if ('error' in authResult) return authResult.error;

        await dbConnect();
        const { id } = await params;

        const existing = await BloodRequest.findById(id).select('hospitalId');
        if (!existing) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });

        const isAdmin = authResult.session.user!.role === 'admin';
        const isOwnerHospital = existing.hospitalId?.toString() === authResult.session.user!.id;

        if (!isAdmin && !isOwnerHospital) {
            return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
        }

        const bloodRequest = await BloodRequest.findByIdAndUpdate(id, { status: 'Cancelled' }, { new: true });
        if (!bloodRequest) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
        return NextResponse.json({ success: true, message: 'Request cancelled' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
