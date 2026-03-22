'use client';

import { Component, type ReactNode } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <GlassCard className="p-8 max-w-md text-center">
                        <span className="text-5xl block mb-4">⚠️</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
                            {this.state.error?.message || 'An unexpected error occurred.'}
                        </p>
                        <GlowButton
                            variant="outline"
                            onClick={() => this.setState({ hasError: false, error: null })}
                        >
                            Try Again
                        </GlowButton>
                    </GlassCard>
                </div>
            );
        }

        return this.props.children;
    }
}
