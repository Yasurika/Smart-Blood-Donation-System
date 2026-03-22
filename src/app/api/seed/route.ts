import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Hospital from '@/lib/models/Hospital';
import Badge from '@/lib/models/Badge';
import Campaign from '@/lib/models/Campaign';
import BloodStock from '@/lib/models/BloodStock';

export async function GET() {
    try {
        await dbConnect();

        // ─── 1. Seed Hospital ───────────────────────────────
        const hospitalEmail = 'hospital@smartblood.lk';
        let hospital = await Hospital.findOne({ email: hospitalEmail });

        if (!hospital) {
            const hashedPassword = await bcrypt.hash('hospital123', 12);
            hospital = await Hospital.create({
                name: 'General Hospital Colombo',
                email: hospitalEmail,
                password: hashedPassword,
                address: 'Regent Street, Colombo 10',
                phone: '+94112691111',
                contactPerson: 'Dr. Perera',
                location: { type: 'Point', coordinates: [79.8612, 6.9271] },
                role: 'hospital',
                operatingHours: { open: '08:00', close: '18:00' },
            });
        }

        // ─── 2. Seed Badges ────────────────────────────────
        const badgeSeeds = [
            { name: 'Life Saver', icon: '❤️', description: 'Donated 10+ times', xpRequired: 1000 },
            { name: 'First Responder', icon: '🚨', description: 'Responded to an emergency request', xpRequired: 500 },
            { name: 'Campaign Hero', icon: '🎯', description: 'Attended 5+ campaigns', xpRequired: 750 },
            { name: 'Century Club', icon: '💯', description: '100% eligibility score', xpRequired: 300 },
            { name: 'Rare Gem', icon: '💎', description: 'Rare blood type donor (AB-, O-, B-)', xpRequired: 200 },
            { name: 'Streak Master', icon: '🔥', description: '6 consecutive monthly donations', xpRequired: 2000 },
            { name: 'Platinum Member', icon: '👑', description: '50+ donations', xpRequired: 5000 },
            { name: 'Campus Hero', icon: '🎓', description: 'Donated at a university campaign', xpRequired: 150 },
        ];

        for (const badge of badgeSeeds) {
            await Badge.findOneAndUpdate(
                { name: badge.name },
                { $setOnInsert: badge },
                { upsert: true }
            );
        }

        // ─── 3. Seed Donors ────────────────────────────────
        const donorEmail = 'donor@smartblood.lk';
        const donorNic = '200112300456';
        const hashedDonorPw = await bcrypt.hash('Donor@123', 12);

        let donor = await User.findOne({ email: donorEmail });
        if (!donor) {
            donor = await User.create({
                name: 'Kamal Perera',
                email: donorEmail,
                nicNumber: donorNic,
                password: hashedDonorPw,
                bloodType: 'O+',
                weight: 72,
                address: '123 Galle Road, Colombo 03',
                phone: '+94771234567',
                role: 'donor',
                xp: 2450,
                totalDonations: 12,
            });
        } else if (!donor.nicNumber) {
            await User.updateOne(
                { _id: donor._id },
                { $set: { nicNumber: donorNic } }
            );
        }

        // ─── 4. Seed Admin ─────────────────────────────────
        const adminEmail = 'admin@smartblood.lk';
        const adminExists = await User.findOne({ email: adminEmail });

        if (!adminExists) {
            const hashedAdminPw = await bcrypt.hash('Admin@123', 12);
            await User.create({
                name: 'System Admin',
                email: adminEmail,
                password: hashedAdminPw,
                bloodType: 'AB+',
                weight: 70,
                address: 'System',
                phone: '+94110000000',
                role: 'admin',
            });
        } else {
            // Reset lock & update password on re-seed
            const hashedAdminPw = await bcrypt.hash('Admin@123', 12);
            await User.updateOne({ email: adminEmail }, {
                $set: { password: hashedAdminPw, failedLoginAttempts: 0, lockedUntil: null },
            });
        }

        // ─── 4b. Seed Secondary Admin ───────────────────────
        const admin2Email = 'superadmin@smartblood.lk';
        const admin2Exists = await User.findOne({ email: admin2Email });

        if (!admin2Exists) {
            const hashedAdmin2Pw = await bcrypt.hash('Super@2026', 12);
            await User.create({
                name: 'Super Admin',
                email: admin2Email,
                password: hashedAdmin2Pw,
                bloodType: 'O+',
                weight: 70,
                address: 'System',
                phone: '+94110000001',
                role: 'admin',
            });
        } else {
            const hashedAdmin2Pw = await bcrypt.hash('Super@2026', 12);
            await User.updateOne({ email: admin2Email }, {
                $set: { password: hashedAdmin2Pw, failedLoginAttempts: 0, lockedUntil: null },
            });
        }

        // ─── 5. Seed Blood Stock ───────────────────────────
        const stockTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        const stockUnits = [245, 42, 189, 28, 67, 15, 312, 23];
        const existingStock = await BloodStock.countDocuments({ hospitalId: hospital._id });

        if (existingStock === 0) {
            for (let i = 0; i < stockTypes.length; i++) {
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 30 + Math.floor(Math.random() * 12));
                const barcode = `SB-${stockTypes[i].replace('+', 'P').replace('-', 'N')}-${Date.now()}-${i}`;
                await BloodStock.create({
                    hospitalId: hospital._id,
                    bloodType: stockTypes[i],
                    units: stockUnits[i],
                    expiryDate: expiry,
                    status: 'Available',
                    component: 'Whole Blood',
                    barcode,
                });
            }
        }

        // ─── 6. Seed Campaigns ─────────────────────────────
        const existingCampaigns = await Campaign.countDocuments();
        if (existingCampaigns === 0) {
            const now = new Date();
            const campaigns = [
                {
                    title: 'National Blood Donation Drive 2026',
                    description: "Join Sri Lanka's largest blood donation event. Multiple locations across Colombo with free health checks and refreshments.",
                    date: new Date(now.getFullYear(), now.getMonth() + 1, 15),
                    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 16),
                    location: { address: 'Bandaranaike Memorial Conference Hall, Colombo' },
                    organizerId: donor._id,
                    maxCapacity: 500,
                    bloodTypesNeeded: ['O-', 'B-', 'AB-'],
                },
                {
                    title: 'NSBM University Blood Heroes',
                    description: 'Campus-wide blood donation campaign. Earn the "Campus Hero" badge!',
                    date: new Date(now.getFullYear(), now.getMonth() + 1, 22),
                    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 22),
                    location: { address: 'NSBM Green University, Homagama' },
                    organizerId: donor._id,
                    maxCapacity: 200,
                    tags: ['university', 'campus'],
                },
                {
                    title: 'Emergency O- Drive — Kandy',
                    description: 'Critical shortage of O Negative blood in Kandy region. Urgent help needed.',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6),
                    location: { address: 'Teaching Hospital, Kandy' },
                    organizerId: donor._id,
                    maxCapacity: 150,
                    bloodTypesNeeded: ['O-'],
                    tags: ['emergency'],
                },
            ];

            for (const c of campaigns) {
                await Campaign.create(c);
            }
        }

        return NextResponse.json({
            message: 'Database seeded successfully',
            credentials: {
                donor: { email: 'donor@smartblood.lk', password: 'Donor@123' },
                hospital: { email: 'hospital@smartblood.lk', password: 'hospital123' },
                admin: { email: 'admin@smartblood.lk', password: 'Admin@123' },
                superadmin: { email: 'superadmin@smartblood.lk', password: 'Super@2026' },
            },
        });
    } catch (error: any) {
        console.error('Seeding error:', error);
        return NextResponse.json({ error: 'Seeding failed', details: error.message }, { status: 500 });
    }
}
