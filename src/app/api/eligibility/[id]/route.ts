import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import EligibilityReport from '@/lib/models/EligibilityReport';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const report = await EligibilityReport.findById(id).populate('donorId', 'name bloodType');
        if (!report) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: report }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const report = await EligibilityReport.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!report) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: report }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const report = await EligibilityReport.findByIdAndDelete(id);
        if (!report) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
        return NextResponse.json({ success: true, message: 'Report archived' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
