import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function StockLayout({ children }: { children: ReactNode }) {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const role = session.user.role;
    if (role !== 'hospital' && role !== 'admin') {
        redirect('/dashboard');
    }

    return <>{children}</>;
}
