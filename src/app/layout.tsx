import type { Metadata } from "next";
import "./globals.css";
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

import CustomCursor from '@/components/animations/CustomCursor';
import SmoothScroll from '@/components/animations/SmoothScroll';
import BloodCellsBackground from '@/components/3d/BloodCellsBackground';
import ChatBot from '@/components/chatbot/ChatBot';

export const metadata: Metadata = {
  title: "SmartBlood | Intelligent Blood Donation & Emergency Response",
  description: "AI-driven blood donation & emergency response system for Sri Lanka. Real-time donor matching, smart eligibility checking, and emergency blood dispatch.",
  keywords: ["blood donation", "Sri Lanka", "emergency blood", "donor matching", "SmartBlood"],
};

import { Providers } from './providers';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-white dark:bg-[#0a0a0a] text-black dark:text-white antialiased transition-colors duration-300">
        <Providers>
          <CustomCursor />
          <BloodCellsBackground />
          <SmoothScroll>
            <Navbar />
            <main className="relative z-10 min-h-screen">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
            <Footer />
          </SmoothScroll>
          <ChatBot />
        </Providers>
      </body>
    </html>
  );
}
