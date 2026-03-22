import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Hospital from '@/lib/models/Hospital';
import Appointment from '@/lib/models/Appointment';
import BloodRequest from '@/lib/models/BloodRequest';
import BloodStock from '@/lib/models/BloodStock';
import Campaign from '@/lib/models/Campaign';
import EligibilityReport from '@/lib/models/EligibilityReport';
import AuditLog from '@/lib/models/AuditLog';
import Notification from '@/lib/models/Notification';
import { apiSuccess, apiError, requireAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(['admin']);
    if ('error' in authResult) return authResult.error;

    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const section = searchParams.get('section') || 'overview';

        if (section === 'overview') {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            const [
                totalDonors, totalHospitals, totalAppointments,
                activeRequests, totalStock, totalCampaigns,
                recentDonors, recentAppointments, recentRequests,
                completedAppointments, cancelledAppointments,
                eligibilityReports, totalNotifications,
            ] = await Promise.all([
                User.countDocuments({ role: 'donor' }),
                Hospital.countDocuments(),
                Appointment.countDocuments(),
                BloodRequest.countDocuments({ status: 'Active' }),
                BloodStock.countDocuments({ status: 'Available' }),
                Campaign.countDocuments(),
                User.countDocuments({ role: 'donor', createdAt: { $gte: thirtyDaysAgo } }),
                Appointment.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
                BloodRequest.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
                Appointment.countDocuments({ status: 'Completed' }),
                Appointment.countDocuments({ status: 'Cancelled' }),
                EligibilityReport.countDocuments(),
                Notification.countDocuments(),
            ]);

            // Blood type distribution of donors
            const bloodTypeDistribution = await User.aggregate([
                { $match: { role: 'donor' } },
                { $group: { _id: '$bloodType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]);

            // Stock summary by blood type
            const stockSummary = await BloodStock.aggregate([
                { $match: { status: 'Available' } },
                { $group: { _id: '$bloodType', totalUnits: { $sum: '$units' }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]);

            // Appointments by status
            const appointmentsByStatus = await Appointment.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]);

            // Requests by urgency
            const requestsByUrgency = await BloodRequest.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: '$urgency', count: { $sum: 1 } } },
            ]);

            // Registration trend (last 30 days, grouped by day)
            const registrationTrend = await User.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    }
                },
                { $sort: { _id: 1 } },
            ]);

            // Appointment trend (last 30 days)
            const appointmentTrend = await Appointment.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    }
                },
                { $sort: { _id: 1 } },
            ]);

            // District distribution
            const districtDistribution = await User.aggregate([
                { $match: { role: 'donor', district: { $exists: true, $ne: '' } } },
                { $group: { _id: '$district', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]);

            // Eligibility results distribution
            const eligibilityResults = await EligibilityReport.aggregate([
                { $group: { _id: '$result', count: { $sum: 1 } } },
            ]);

            return apiSuccess({
                kpi: {
                    totalDonors, totalHospitals, totalAppointments,
                    activeRequests, totalStock, totalCampaigns,
                    recentDonors, recentAppointments, recentRequests,
                    completedAppointments, cancelledAppointments,
                    eligibilityReports, totalNotifications,
                    completionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
                },
                charts: {
                    bloodTypeDistribution,
                    stockSummary,
                    appointmentsByStatus,
                    requestsByUrgency,
                    registrationTrend,
                    appointmentTrend,
                    districtDistribution,
                    eligibilityResults,
                },
            });
        }

        if (section === 'users') {
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '20');
            const search = searchParams.get('search') || '';
            const bloodType = searchParams.get('bloodType') || '';

            const filter: Record<string, unknown> = { role: 'donor' };
            if (search) filter.name = { $regex: search, $options: 'i' };
            if (bloodType) filter.bloodType = bloodType;

            const [users, total] = await Promise.all([
                User.find(filter)
                    .select('-password -failedLoginAttempts -lockedUntil')
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean(),
                User.countDocuments(filter),
            ]);

            return apiSuccess({ users, total, page, limit, totalPages: Math.ceil(total / limit) });
        }

        if (section === 'hospitals') {
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '20');
            const search = searchParams.get('search') || '';

            const filter: Record<string, unknown> = {};
            if (search) filter.name = { $regex: search, $options: 'i' };

            const [hospitals, total] = await Promise.all([
                Hospital.find(filter)
                    .select('-password -failedLoginAttempts -lockedUntil')
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean(),
                Hospital.countDocuments(filter),
            ]);

            return apiSuccess({ hospitals, total, page, limit, totalPages: Math.ceil(total / limit) });
        }

        if (section === 'audit-logs') {
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '30');
            const action = searchParams.get('action') || '';
            const entity = searchParams.get('entity') || '';

            const filter: Record<string, unknown> = {};
            if (action) filter.action = action;
            if (entity) filter.entity = entity;

            const [logs, total] = await Promise.all([
                AuditLog.find(filter)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean(),
                AuditLog.countDocuments(filter),
            ]);

            return apiSuccess({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
        }

        if (section === 'system') {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const [recentAuditLogs, recentNotifications, expiringStock] = await Promise.all([
                AuditLog.countDocuments({ createdAt: { $gte: oneDayAgo } }),
                Notification.countDocuments({ createdAt: { $gte: oneDayAgo } }),
                BloodStock.countDocuments({
                    status: 'Available',
                    expiryDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
                }),
            ]);

            return apiSuccess({
                recentAuditLogs,
                recentNotifications,
                expiringStock,
                cronEndpoints: [
                    { name: 'Donation Reminders', path: '/api/cron/reminders', schedule: 'Daily 8:00 AM' },
                    { name: 'Stock Alerts', path: '/api/cron/stock-alerts', schedule: 'Every 6 hours' },
                ],
                aiEngine: { url: 'http://localhost:5050', endpoints: ['/api/forecast', '/api/risk-assess', '/api/stock-analyze'] },
            });
        }

        return apiError('Invalid section', 400);
    } catch (error) {
        return apiError('Failed to fetch admin data: ' + (error as Error).message, 500);
    }
}
