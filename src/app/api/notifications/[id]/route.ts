import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/lib/models/Notification';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const notification = await Notification.findByIdAndUpdate(id, body, { new: true });
        if (!notification) return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: notification }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const notification = await Notification.findByIdAndDelete(id);
        if (!notification) return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
        return NextResponse.json({ success: true, message: 'Notification deleted' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
