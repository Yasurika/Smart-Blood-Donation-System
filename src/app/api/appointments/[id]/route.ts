import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Appointment from '@/lib/models/Appointment';
import User from '@/lib/models/User';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const appointment = await Appointment.findById(id)
            .populate('donorId', 'name bloodType phone')
            .populate('hospitalId', 'name address');
        if (!appointment) return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: appointment }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const appointment = await Appointment.findById(id);
        if (!appointment) return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });

        const wasNotCompleted = appointment.status !== 'Completed';
        const isNowCompleted = body.status === 'Completed';

        const updated = await Appointment.findByIdAndUpdate(id, body, { new: true, runValidators: true });

        // Auto-update donor stats when appointment is marked as Completed
        if (wasNotCompleted && isNowCompleted && appointment.donorId) {
            await User.findByIdAndUpdate(appointment.donorId, {
                $set: { lastDonationDate: new Date() },
                $inc: { totalDonations: 1, xp: 100 },
                $addToSet: { donationHistory: appointment._id },
            });
        }

        return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const appointment = await Appointment.findByIdAndUpdate(id, { status: 'Cancelled' }, { new: true });
        if (!appointment) return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
        return NextResponse.json({ success: true, message: 'Appointment cancelled' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
