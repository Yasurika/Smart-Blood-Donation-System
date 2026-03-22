import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Notification from '@/lib/models/Notification';
import logger from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-utils';

// Cron-style endpoint: POST /api/cron/reminders
// Call this via a scheduled job (e.g. Vercel Cron, external cron service)
// Authorization: requires CRON_SECRET header or admin session
export async function POST(req: NextRequest) {
    // Verify cron secret or skip in development
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return apiError('Unauthorized', 401);
    }

    try {
        await dbConnect();

        const now = new Date();
        let remindersCreated = 0;
        let eligibleNotified = 0;

        // ─── 1. Donors who are now eligible again (56 days for male, 84 for female) ───
        const MALE_GAP_DAYS = 56;
        const FEMALE_GAP_DAYS = 84;
        const maleThreshold = new Date(now.getTime() - MALE_GAP_DAYS * 24 * 60 * 60 * 1000);
        const femaleThreshold = new Date(now.getTime() - FEMALE_GAP_DAYS * 24 * 60 * 60 * 1000);

        // Donors who donated and are now past their gap period
        const eligibleDonors = await User.find({
            role: 'donor',
            isActive: true,
            lastDonationDate: { $exists: true },
            $or: [
                { gender: 'male', lastDonationDate: { $lte: maleThreshold } },
                { gender: 'female', lastDonationDate: { $lte: femaleThreshold } },
                // For donors without gender, use male threshold (shorter)
                { gender: { $exists: false }, lastDonationDate: { $lte: maleThreshold } },
            ],
        }).select('_id name lastDonationDate gender').lean();

        for (const donor of eligibleDonors) {
            // Check if we already sent an eligibility reminder recently (within 7 days)
            const recentReminder = await Notification.findOne({
                userId: donor._id,
                title: 'You Are Eligible to Donate Again!',
                createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            });

            if (!recentReminder) {
                const lastDate = new Date(donor.lastDonationDate!);
                const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

                await Notification.create({
                    userId: donor._id,
                    type: 'System',
                    title: 'You Are Eligible to Donate Again!',
                    message: `It has been ${daysSince} days since your last donation. You are now eligible to donate blood again. Book an appointment today and save a life!`,
                    link: '/dashboard/appointments',
                    priority: 'high',
                });
                eligibleNotified++;
            }
        }

        // ─── 2. Donors approaching eligibility (5 days before they become eligible) ───
        const malePreThreshold = new Date(now.getTime() - (MALE_GAP_DAYS - 5) * 24 * 60 * 60 * 1000);
        const femalePreThreshold = new Date(now.getTime() - (FEMALE_GAP_DAYS - 5) * 24 * 60 * 60 * 1000);

        const approachingDonors = await User.find({
            role: 'donor',
            isActive: true,
            lastDonationDate: { $exists: true },
            $or: [
                {
                    gender: 'male',
                    lastDonationDate: {
                        $lte: malePreThreshold,
                        $gt: maleThreshold,
                    },
                },
                {
                    gender: 'female',
                    lastDonationDate: {
                        $lte: femalePreThreshold,
                        $gt: femaleThreshold,
                    },
                },
            ],
        }).select('_id name lastDonationDate gender').lean();

        for (const donor of approachingDonors) {
            const recentReminder = await Notification.findOne({
                userId: donor._id,
                title: 'Almost Time to Donate Again!',
                createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            });

            if (!recentReminder) {
                const gapDays = donor.gender === 'female' ? FEMALE_GAP_DAYS : MALE_GAP_DAYS;
                const eligibleDate = new Date(new Date(donor.lastDonationDate!).getTime() + gapDays * 24 * 60 * 60 * 1000);
                const daysLeft = Math.ceil((eligibleDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

                await Notification.create({
                    userId: donor._id,
                    type: 'System',
                    title: 'Almost Time to Donate Again!',
                    message: `You will be eligible to donate blood in ${daysLeft} days (${eligibleDate.toLocaleDateString()}). Start planning your next donation!`,
                    link: '/eligibility',
                    priority: 'medium',
                });
                remindersCreated++;
            }
        }

        // ─── 3. Donors who registered but never donated (7+ days old accounts) ───
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const neverDonated = await User.find({
            role: 'donor',
            isActive: true,
            lastDonationDate: { $exists: false },
            totalDonations: 0,
            createdAt: { $lte: weekAgo },
        }).select('_id name').lean();

        for (const donor of neverDonated) {
            const recentReminder = await Notification.findOne({
                userId: donor._id,
                title: 'Make Your First Donation!',
                createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            });

            if (!recentReminder) {
                await Notification.create({
                    userId: donor._id,
                    type: 'System',
                    title: 'Make Your First Donation!',
                    message: 'You have not made your first blood donation yet. Every donation can save up to 3 lives. Check your eligibility and book an appointment today!',
                    link: '/eligibility',
                    priority: 'medium',
                });
                remindersCreated++;
            }
        }

        const summary = {
            eligibleNotified,
            approachingReminders: remindersCreated,
            neverDonatedReminders: neverDonated.length,
            totalProcessed: eligibleDonors.length + approachingDonors.length + neverDonated.length,
        };

        logger.info('Donation reminders processed', summary);
        return apiSuccess(summary);
    } catch (error) {
        logger.error('Reminder cron failed', { error: (error as Error).message });
        return apiError('Failed to process reminders', 500);
    }
}

// GET endpoint to check status (useful for monitoring)
export async function GET() {
    return apiSuccess({ status: 'Reminder cron endpoint active', method: 'POST to trigger' });
}
