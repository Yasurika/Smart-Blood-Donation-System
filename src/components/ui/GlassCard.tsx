'use client';

import { motion } from 'framer-motion';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    glow?: boolean;
}

export default function GlassCard({ children, className = '', hover = true, glow = false }: GlassCardProps) {
    return (
        <motion.div
            whileHover={hover ? { y: -5, scale: 1.02 } : {}}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`
        relative overflow-hidden rounded-2xl
        bg-white/60 dark:bg-white/5 backdrop-blur-xl
        border border-gray-200 dark:border-white/10
        shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]
        ${glow ? 'shadow-red-500/10 dark:shadow-red-500/20' : ''}
        ${hover ? 'hover:border-red-500/20 hover:shadow-red-500/5 dark:hover:border-red-500/30 dark:hover:shadow-red-500/10 hover:bg-white/80 dark:hover:bg-white/10' : ''}
        transition-all duration-500
        ${className}
      `}
        >
            {/* Gradient sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/5 dark:via-transparent dark:to-transparent pointer-events-none" />
            <div className="relative z-10">{children}</div>
        </motion.div>
    );
}
