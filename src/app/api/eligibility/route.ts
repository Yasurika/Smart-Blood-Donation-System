import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import EligibilityReport from '@/lib/models/EligibilityReport';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const donorId = searchParams.get('donorId');

        const filter: Record<string, string> = {};
        if (donorId) filter.donorId = donorId;

        const reports = await EligibilityReport.find(filter)
            .populate('donorId', 'name bloodType')
            .sort({ createdAt: -1 });
        return NextResponse.json({ success: true, data: reports }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();
        const report = await EligibilityReport.create(body);
        return NextResponse.json({ success: true, data: report }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}
