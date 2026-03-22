'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import ThemeToggle from './ThemeToggle';
import LogoutButton from '@/components/auth/LogoutButton';

function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications?limit=5');
            if (res.ok) {
                const json = await res.json();
                setNotifications(json.data || []);
                setUnreadCount(json.meta?.unreadCount || 0);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAllRead = async () => {
        try {
            await fetch('/api/notifications', { method: 'PATCH' });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch { /* silent */ }
    };

    return (
        <div className="relative">
            <button
                onClick={() => { setShowDropdown(!showDropdown); if (!showDropdown) fetchNotifications(); }}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {showDropdown && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden z-50"
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
                            {unreadCount > 0 && (
                                <button onClick={markAllRead} className="text-xs text-red-500 hover:text-red-400">
                                    Mark all read
                                </button>
                            )}
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                            {notifications.length > 0 ? notifications.map((n: any) => (
                                <div key={n._id} className={`px-4 py-3 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 ${!n.isRead ? 'bg-red-50/50 dark:bg-red-500/5' : ''}`}>
                                    <p className="text-sm text-gray-800 dark:text-gray-200">{n.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{n.message?.slice(0, 60)}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                                </div>
                            )) : (
                                <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications</div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Campaigns', href: '/campaigns' },
    { name: 'Eligibility', href: '/eligibility' },
    { name: 'Blood Locations', href: '/blood-locations' },
    { name: 'Leaderboard', href: '/dashboard/leaderboard' },
];

const adminLinks = [
    ...navLinks,
    { name: 'Admin Panel', href: '/dashboard/admin' },
];

export default function Navbar() {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 z-50"
        >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mt-4 flex h-16 items-center justify-between rounded-2xl bg-black/30 dark:bg-black/30 backdrop-blur-xl border border-white/10 dark:border-white/10 px-6 dark:border-white/10 border-black/20 dark:border-white/10">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group" data-cursor="pointer">
                        <motion.div
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                            className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                                <path d="M12 2C12 2 4 10 4 14.5C4 18.64 7.58 22 12 22C16.42 22 20 18.64 20 14.5C20 10 12 2 12 2Z" fill="currentColor" />
                            </svg>
                        </motion.div>
                        <span className="text-xl font-bold bg-gradient-to-r from-black dark:from-white to-gray-600 dark:to-gray-400 bg-clip-text text-transparent">
                            Smart<span className="text-red-500">Blood</span>
                        </span>
                    </Link>

                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-1">
                        {(session?.user?.role === 'admin' ? adminLinks : navLinks).map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                data-cursor="pointer"
                                className="relative px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors duration-300 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 group"
                            >
                                {link.name}
                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-red-500 group-hover:w-3/4 transition-all duration-300 rounded-full" />
                            </Link>
                        ))}
                    </div>

                    {/* CTA + Mobile Toggle */}
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        {session?.user ? (
                            <div className="flex items-center gap-3">
                                <NotificationBell />
                                <Link href="/dashboard" className="hidden sm:inline-flex text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white">
                                    Dashboard
                                </Link>
                                <LogoutButton />
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                data-cursor="pointer"
                                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-sm font-semibold hover:from-red-500 hover:to-red-400 transition-all duration-300 shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
                            >
                                <span>Sign In</span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </Link>
                        )}

                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="md:hidden p-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
                            data-cursor="pointer"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                {isOpen ? (
                                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
                                ) : (
                                    <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="md:hidden mx-4 mt-2 overflow-hidden rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/10 dark:border-white/10"
                    >
                        <div className="p-4 space-y-1">
                            {(session?.user?.role === 'admin' ? adminLinks : navLinks).map((link, i) => (
                                <motion.div
                                    key={link.name}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Link
                                        href={link.href}
                                        onClick={() => setIsOpen(false)}
                                        className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all"
                                    >
                                        {link.name}
                                    </Link>
                                </motion.div>
                            ))}
                            <div className="pt-4 border-t border-black/10 dark:border-white/10 mt-2">
                                {session?.user ? (
                                    <div className="px-4">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold">
                                                {session.user.name?.[0] || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-black dark:text-white font-medium">{session.user.name}</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{session.user.role}</p>
                                            </div>
                                        </div>
                                        <LogoutButton />
                                    </div>
                                ) : (
                                    <Link
                                        href="/login"
                                        onClick={() => setIsOpen(false)}
                                        className="block px-4 py-3 text-center bg-red-600 text-white rounded-xl font-medium"
                                    >
                                        Sign In
                                    </Link>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    );
}
