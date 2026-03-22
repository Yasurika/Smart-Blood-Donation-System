'use client';

import { signOut } from 'next-auth/react';
import GlowButton from '@/components/ui/GlowButton';

export default function LogoutButton() {
    return (
        <GlowButton
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 border-none bg-transparent hover:bg-white/5 text-slate-300 hover:text-red-400 p-0"
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Logout</span>
        </GlowButton>
    );
}
