'use client';

import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="relative border-t border-white/10 bg-black/50 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                    {/* Brand */}
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                                    <path d="M12 2C12 2 4 10 4 14.5C4 18.64 7.58 22 12 22C16.42 22 20 18.64 20 14.5C20 10 12 2 12 2Z" fill="currentColor" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-white">
                                Smart<span className="text-red-500">Blood</span>
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            AI-driven blood donation & emergency response system for Sri Lanka. Every drop counts.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Platform</h3>
                        <ul className="space-y-3">
                            {['Donate Blood', 'Find Blood', 'Campaigns', 'Eligibility Check'].map((link) => (
                                <li key={link}>
                                    <Link href="#" className="text-sm text-gray-400 hover:text-red-400 transition-colors">
                                        {link}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Resources</h3>
                        <ul className="space-y-3">
                            {['Blood Types Guide', 'Donation FAQ', 'Hospitals', 'Contact Us'].map((link) => (
                                <li key={link}>
                                    <Link href="#" className="text-sm text-gray-400 hover:text-red-400 transition-colors">
                                        {link}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contact</h3>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                info@smartblood.lk
                            </li>
                            <li className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                </svg>
                                +94 11 234 5678
                            </li>
                            <li className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                Colombo, Sri Lanka
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">
                        © 2026 SmartBlood. Group 36 | PUSL2021. All rights reserved.
                    </p>
                    <div className="flex gap-4">
                        {['Privacy', 'Terms', 'Cookies'].map((link) => (
                            <Link key={link} href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                                {link}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
