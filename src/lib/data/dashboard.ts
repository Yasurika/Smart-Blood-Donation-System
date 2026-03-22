import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Appointment from "@/lib/models/Appointment";
import BloodStock from "@/lib/models/BloodStock";
import BloodRequest from "@/lib/models/BloodRequest";
import Hospital from "@/lib/models/Hospital"; // Ensure model is imported
import "@/lib/models/Badge"; // Ensure Badge model is registered

// Types for Dashboard Data
export interface DonorDashboardData {
    user: any;
    stats: {
        donations: number;
        livesSaved: number;
        xp: number;
        badges: number;
    };
    recentActivity: {
        id: string;
        action: string;
        time: string; // formatted date
        type: 'success' | 'info' | 'achievement' | 'warning';
    }[];
}

export interface HospitalDashboardData {
    hospital: any;
    stats: {
        collected: number;
        pending: number;
        fulfilled: number;
    };
    recentRequests: {
        id: string;
        ref: string;
        bloodType: string;
        urgency: string;
        status: string;
        date: string;
    }[];
    lowStockAlerts: {
        type: string;
        units: number;
    }[];
}

export async function getDonorDashboardData(userId: string): Promise<DonorDashboardData> {
    await dbConnect();

    const user = await User.findById(userId).populate('badges');
    if (!user) throw new Error("User not found");

    // 1. Stats
    const donationCount = await Appointment.countDocuments({ donorId: userId, status: 'Completed' });
    const stats = {
        donations: donationCount,
        livesSaved: donationCount * 3,
        xp: user.xp || 0,
        badges: user.badges?.length || 0,
    };

    // 2. Recent Activity (Appointments)
    const recentAppointments = await Appointment.find({ donorId: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('hospitalId', 'name');

    const activities = recentAppointments.map((app: any) => ({
        id: app._id.toString(),
        action: `${app.status} Appointment at ${app.hospitalId?.name || 'Hospital'}`,
        time: new Date(app.date).toLocaleDateString(),
        type: app.status === 'Completed' ? 'success' : app.status === 'Scheduled' ? 'info' : 'warning' as any
    }));

    return {
        user: JSON.parse(JSON.stringify(user)), // Serialize for Next.js
        stats,
        recentActivity: JSON.parse(JSON.stringify(activities))
    };
}

export async function getHospitalDashboardData(hospitalId: string): Promise<HospitalDashboardData> {
    await dbConnect();

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) throw new Error("Hospital not found");

    // 1. KPI Stats
    const collected = await Appointment.countDocuments({ hospitalId, status: 'Completed' });
    const pending = await Appointment.countDocuments({ hospitalId, status: 'Scheduled' });
    const fulfilled = await BloodRequest.countDocuments({ hospitalId, status: 'Fulfilled' });

    // 2. Recent Requests
    const requests = await BloodRequest.find({ hospitalId })
        .sort({ createdAt: -1 })
        .limit(5);

    const serializedRequests = requests.map((req: any) => ({
        id: req._id.toString(),
        ref: `#REQ-${req._id.toString().substring(0, 6).toUpperCase()}`,
        bloodType: req.bloodType,
        urgency: req.urgency,
        status: req.status,
        date: new Date(req.createdAt).toLocaleDateString()
    }));

    // 3. Low Stock Alerts
    const stock = await BloodStock.find({ hospitalId });
    // Aggregate by type locally or via DB. Since specific units might have expiry, keeping it simple: sum by type
    const stockMap: Record<string, number> = {};
    stock.forEach((s: any) => {
        stockMap[s.bloodType] = (stockMap[s.bloodType] || 0) + s.units;
    });

    const lowStockAlerts = Object.entries(stockMap)
        .filter(([_, units]) => units < 20) // Threshold for alert
        .map(([type, units]) => ({ type, units }));

    return {
        hospital: JSON.parse(JSON.stringify(hospital)),
        stats: { collected, pending, fulfilled },
        recentRequests: JSON.parse(JSON.stringify(serializedRequests)),
        lowStockAlerts
    };
}
