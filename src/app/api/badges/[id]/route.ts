import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Badge from '@/lib/models/Badge';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const badge = await Badge.findById(id);
        if (!badge) return NextResponse.json({ success: false, error: 'Badge not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: badge }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const badge = await Badge.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!badge) return NextResponse.json({ success: false, error: 'Badge not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: badge }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const badge = await Badge.findByIdAndDelete(id);
        if (!badge) return NextResponse.json({ success: false, error: 'Badge not found' }, { status: 404 });
        return NextResponse.json({ success: true, message: 'Badge revoked' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
