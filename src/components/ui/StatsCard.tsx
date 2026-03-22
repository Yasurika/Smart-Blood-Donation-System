'use client';

import GlassCard from './GlassCard';
import AnimatedCounter from '../animations/AnimatedCounter';

interface StatsCardProps {
    icon: React.ReactNode;
    value: number;
    label: string;
    suffix?: string;
    prefix?: string;
    color?: string;
}

export default function StatsCard({ icon, value, label, suffix = '', prefix = '', color = 'red' }: StatsCardProps) {
    const colorMap: Record<string, string> = {
        red: 'from-red-500/20 to-red-600/5 border-red-500/20',
        blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
        green: 'from-green-500/20 to-green-600/5 border-green-500/20',
        purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
        orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/20',
    };

    const iconColor: Record<string, string> = {
        red: 'text-red-400',
        blue: 'text-blue-400',
        green: 'text-green-400',
        purple: 'text-purple-400',
        orange: 'text-orange-400',
    };

    return (
        <GlassCard className={`p-6 bg-gradient-to-br ${colorMap[color]}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-400 mb-1">{label}</p>
                    <AnimatedCounter
                        target={value}
                        prefix={prefix}
                        suffix={suffix}
                        className="text-3xl font-bold text-white"
                    />
                </div>
                <div className={`p-3 rounded-xl bg-white/5 ${iconColor[color]}`}>
                    {icon}
                </div>
            </div>
        </GlassCard>
    );
}
