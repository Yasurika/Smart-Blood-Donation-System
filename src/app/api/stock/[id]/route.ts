import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BloodStock from '@/lib/models/BloodStock';
import { requireAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireAuth(['hospital', 'admin']);
    if ('error' in authResult) return authResult.error;

    try {
        await dbConnect();
        const { id } = await params;
        const stock = await BloodStock.findById(id).populate('hospitalId', 'name address');
        if (!stock) return NextResponse.json({ success: false, error: 'Stock not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: stock }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireAuth(['hospital', 'admin']);
    if ('error' in authResult) return authResult.error;

    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const stock = await BloodStock.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!stock) return NextResponse.json({ success: false, error: 'Stock not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: stock }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireAuth(['hospital', 'admin']);
    if ('error' in authResult) return authResult.error;

    try {
        await dbConnect();
        const { id } = await params;
        const stock = await BloodStock.findByIdAndUpdate(id, { status: 'Discarded' }, { new: true });
        if (!stock) return NextResponse.json({ success: false, error: 'Stock not found' }, { status: 404 });
        return NextResponse.json({ success: true, message: 'Stock marked as discarded' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
