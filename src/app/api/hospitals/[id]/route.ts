import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Hospital from '@/lib/models/Hospital';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const hospital = await Hospital.findById(id);
        if (!hospital) return NextResponse.json({ success: false, error: 'Hospital not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: hospital }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const hospital = await Hospital.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!hospital) return NextResponse.json({ success: false, error: 'Hospital not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: hospital }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const hospital = await Hospital.findByIdAndDelete(id);
        if (!hospital) return NextResponse.json({ success: false, error: 'Hospital not found' }, { status: 404 });
        return NextResponse.json({ success: true, message: 'Hospital removed' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
