'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect all role-specific login URLs to the unified login page
export default function RoleLoginPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/login');
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-400">Redirecting to login...</p>
        </div>
    );
}
