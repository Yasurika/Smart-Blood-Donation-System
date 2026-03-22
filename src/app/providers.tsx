'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { LoadScript } from '@react-google-maps/api';
import React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <LoadScript 
                    googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} 
                    libraries={['visualization']}
                    onError={() => console.error('Failed to load Google Maps API')}
                >
                    {children}
                </LoadScript>
            </ThemeProvider>
        </SessionProvider>
    );
}
