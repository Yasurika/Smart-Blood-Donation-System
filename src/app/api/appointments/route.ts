import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import Appointment from '@/lib/models/Appointment';
import User from '@/lib/models/User';
import Hospital from '@/lib/models/Hospital';
import Notification from '@/lib/models/Notification';
import logger from '@/lib/logger';
import { CreateAppointmentSchema } from '@/lib/validations';
import {
    apiSuccess, apiError, validateBody, rateLimit,
    requireAuth, getPaginationParams, paginationMeta, createAuditEntry, getClientIp
} from '@/lib/api-utils';

export async function GET(request: NextRequest) {
    const rateLimited = rateLimit(request, { keyPrefix: 'appointments-list' });
    if (rateLimited) return rateLimited;

    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);

        // ─── Slot availability check: GET /api/appointments?bookedSlots=true&hospitalId=x&date=y ───
        if (searchParams.get('bookedSlots') === 'true') {
            const hospitalId = searchParams.get('hospitalId');
            const date = searchParams.get('date');
            if (!hospitalId || !date) return apiError('hospitalId and date are required', 400);

            const dayStart = new Date(new Date(date).setHours(0, 0, 0, 0));
            const dayEnd = new Date(new Date(date).setHours(23, 59, 59, 999));

            const booked = await Appointment.find({
                hospitalId,
                date: { $gte: dayStart, $lt: dayEnd },
                status: 'Scheduled',
            }).select('timeSlot').lean();

            const bookedSlots = booked.map(a => a.timeSlot);
            return apiSuccess({ bookedSlots });
        }

        const { page, limit, skip } = getPaginationParams(request);
        const donorId = searchParams.get('donorId');
        const hospitalId = searchParams.get('hospitalId');
        const status = searchParams.get('status');

        const filter: Record<string, string> = {};
        if (donorId) filter.donorId = donorId;
        if (hospitalId) filter.hospitalId = hospitalId;
        if (status) filter.status = status;

        const [appointments, total] = await Promise.all([
            Appointment.find(filter)
                .populate('donorId', 'name bloodType phone')
                .populate('hospitalId', 'name address')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit),
            Appointment.countDocuments(filter),
        ]);

        return apiSuccess(appointments, 200, paginationMeta(page, limit, total));
    } catch (error) {
        logger.error('Failed to fetch appointments', { error: (error as Error).message });
        return apiError('Failed to fetch appointments', 500);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: 'appointments-create' });
    if (rateLimited) return rateLimited;

    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.error;

    try {
        const body = await request.json();
        const validation = validateBody(CreateAppointmentSchema, body);
        if ('error' in validation) return validation.error;

        await dbConnect();

        const { hospitalId, date, timeSlot } = validation.data;
        // Use session user as donor (don't trust client-sent donorId)
        const donorId = validation.data.donorId || authResult.session.user!.id;

        // Verify donor and hospital exist
        const [donor, hospital] = await Promise.all([
            User.findById(donorId),
            Hospital.findById(hospitalId),
        ]);

        if (!donor) return apiError('Donor not found', 404);
        if (!hospital) return apiError('Hospital not found', 404);

        // Check for double-booking (same donor, same date, same time, not cancelled)
        const existingAppointment = await Appointment.findOne({
            donorId,
            date: {
                $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
            },
            timeSlot,
            status: { $in: ['Scheduled'] },
        });

        if (existingAppointment) {
            return apiError('You already have an appointment at this time', 409);
        }

        const appointment = await Appointment.create({ ...validation.data, donorId });

        // Send notification to donor
        await Notification.create({
            userId: donorId,
            type: 'System',
            title: 'Appointment Confirmed',
            message: `Your donation appointment at ${hospital.name} on ${new Date(date).toLocaleDateString()} at ${timeSlot} has been confirmed.`,
            link: '/dashboard/appointments',
            priority: 'medium',
        });

        await createAuditEntry(
            authResult.session.user!.id, 'CREATE', 'Appointment',
            appointment._id.toString(), `Booked appointment at ${hospital.name}`, getClientIp(request)
        );

        logger.info('Appointment created', { appointmentId: appointment._id, donorId, hospitalId });
        return apiSuccess(appointment, 201);
    } catch (error) {
        logger.error('Failed to create appointment', { error: (error as Error).message });
        return apiError('Failed to create appointment', 500);
    }
}
