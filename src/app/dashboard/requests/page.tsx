import { auth } from '@/auth';
import { getActiveRequests } from '@/lib/data/requests';
import RequestsClient from '@/components/dashboard/RequestsClient';
import { redirect } from 'next/navigation';

export default async function RequestsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    const requests = await getActiveRequests({
        id: session.user.id,
        role: session.user.role,
    });
    const userRole = session.user.role || 'donor';

    return <RequestsClient requests={requests} userRole={userRole} />;
}
