import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDonorDashboardData, getHospitalDashboardData } from '@/lib/data/dashboard';
import DonorDashboard from '@/components/dashboard/DonorDashboard';
import HospitalDashboard from '@/components/dashboard/HospitalDashboard';

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user?.email) {
        redirect('/login');
    }

    const { id, role } = session.user;
    const userId = id || ''; // Ensure ID exists. If NextAuth session is valid, ID should be there.

    if (!userId) {
        // Fallback if ID is missing (should ideally be in session)
        // We might need to fetch by email if ID is missing
        redirect('/login');
    }

    // Admin users go to admin panel
    if (role === 'admin') {
        redirect('/dashboard/admin');
    }

    // Fetch data based on role
    let dashboardData;

    try {
        if (role === 'hospital') {
            dashboardData = await getHospitalDashboardData(userId);
        } else {
            dashboardData = await getDonorDashboardData(userId);
        }
    } catch (error) {
        console.error("Dashboard data fetch error:", error);
        return <div className="p-10 text-center text-red-500">Failed to load dashboard data. Please try again later.</div>;
    }

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            {role === 'hospital' ? (
                <HospitalDashboard data={dashboardData as any} />
            ) : (
                <DonorDashboard data={dashboardData as any} />
            )}
        </div>
    );
}
