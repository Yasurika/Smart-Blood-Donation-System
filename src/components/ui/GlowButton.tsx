'use client';

import { motion } from 'framer-motion';

interface GlowButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
}

export default function GlowButton({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    className = '',
    type = 'button',
    disabled = false,
}: GlowButtonProps) {
    const variants = {
        primary:
            'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50',
        secondary:
            'bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white shadow-lg shadow-gray-900/30',
        outline:
            'bg-transparent border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-400',
        danger:
            'bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white shadow-lg shadow-rose-700/30',
    };

    const sizes = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            type={type}
            disabled={disabled}
            data-cursor="pointer"
            className={`
        relative overflow-hidden rounded-xl font-semibold
        transition-all duration-300 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
        >
            {/* Animated shine effect */}
            <span className="absolute inset-0 w-full h-full">
                <span className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] animate-[shine_3s_ease-in-out_infinite]" />
            </span>
            <span className="relative z-10 flex items-center justify-center gap-2">
                {children}
            </span>
        </motion.button>
    );
}
