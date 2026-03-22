import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Badge from '@/lib/models/Badge';

export async function GET() {
    try {
        await dbConnect();
        const badges = await Badge.find().sort({ tier: 1, xpValue: 1 });
        return NextResponse.json({ success: true, data: badges }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();
        const badge = await Badge.create(body);
        return NextResponse.json({ success: true, data: badge }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}
