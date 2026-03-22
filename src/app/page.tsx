'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import ScrollReveal from '@/components/animations/ScrollReveal';
import AnimatedCounter from '@/components/animations/AnimatedCounter';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';

const features = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'AI Eligibility Engine',
    description: 'Conversational AI analyzes your health data to predict eligibility score (0-100%) with personalized recommendations.',
    color: 'from-yellow-500/20 to-yellow-600/5',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Emergency Dispatch',
    description: 'Uber-like real-time tracking. Hospitals request blood, nearby donors get pinged, and respond with live map tracking.',
    color: 'from-red-500/20 to-red-600/5',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Smart Scheduling',
    description: 'AI-powered wait time predictor. Book slots intelligently with "live wait time" estimation based on historical data.',
    color: 'from-blue-500/20 to-blue-600/5',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Stock Forecasting',
    description: 'Predictive analytics alert when blood types are running low. "A+ stock will run out in 3 days — launch a campaign."',
    color: 'from-green-500/20 to-green-600/5',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Gamified Profiles',
    description: 'Earn XP, unlock badges like "Life Saver" and "Rare Gem". Compete on leaderboards to motivate regular donations.',
    color: 'from-purple-500/20 to-purple-600/5',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Hospital Network',
    description: 'Inter-hospital blood exchange. If Hospital A needs B+, it queries nearby hospitals and creates digital transfer requests.',
    color: 'from-orange-500/20 to-orange-600/5',
  },
];

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function StatsSection() {
  const [stats, setStats] = useState([
    { value: 0, label: 'Active Donors', suffix: '+', color: 'from-red-500' },
    { value: 0, label: 'Hospitals Connected', suffix: '+', color: 'from-blue-500' },
    { value: 0, label: 'Campaigns Run', suffix: '', color: 'from-green-500' },
    { value: 0, label: 'Blood Types Tracked', suffix: '', color: 'from-purple-500' },
  ]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [donorsRes, hospitalsRes, campaignsRes] = await Promise.all([
          fetch('/api/donors?limit=1'),
          fetch('/api/hospitals?limit=1'),
          fetch('/api/campaigns?limit=1'),
        ]);
        const [donors, hospitals, campaigns] = await Promise.all([
          donorsRes.json(), hospitalsRes.json(), campaignsRes.json(),
        ]);
        setStats([
          { value: donors.meta?.total || 0, label: 'Active Donors', suffix: '+', color: 'from-red-500' },
          { value: hospitals.meta?.total || 0, label: 'Hospitals Connected', suffix: '+', color: 'from-blue-500' },
          { value: campaigns.meta?.total || 0, label: 'Campaigns Run', suffix: '', color: 'from-green-500' },
          { value: 8, label: 'Blood Types Tracked', suffix: '', color: 'from-purple-500' },
        ]);
      } catch { /* keep defaults */ }
    }
    fetchStats();
  }, []);

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={i * 0.15} direction="up">
              <GlassCard className="p-6 text-center">
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${stat.color} to-white bg-clip-text text-transparent`}
                />
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">{stat.label}</p>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="relative grid-bg">
      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-24">
        {/* Radial gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.15)_0%,_transparent_70%)]" />

        <div className="relative z-10 text-center max-w-5xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 dark:bg-red-500/10 border border-red-500/40 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm mb-8 font-semibold"
          >
            <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500 animate-pulse" />
            AI-Powered Blood Donation System
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-tight tracking-tighter"
          >
            <span className="block text-black dark:text-white font-black">Every Drop</span>
            <span className="block bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 dark:from-red-400 dark:via-pink-400 dark:to-rose-400 bg-clip-text text-transparent">Saves a Life</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="mt-6 text-lg sm:text-xl text-gray-800 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Sri Lanka&apos;s most advanced blood donation platform. AI-driven eligibility,
            real-time emergency dispatch, and a gamified experience that makes saving lives
            effortless.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/eligibility">
              <GlowButton size="lg" variant="primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2C12 2 4 10 4 14.5C4 18.64 7.58 22 12 22C16.42 22 20 18.64 20 14.5C20 10 12 2 12 2Z" fill="currentColor" />
                </svg>
                Check Eligibility
              </GlowButton>
            </Link>
            <Link href="/dashboard">
              <GlowButton size="lg" variant="outline">
                Explore Dashboard
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </GlowButton>
            </Link>
          </motion.div>

          {/* Floating blood types */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.3 }}
            className="mt-16 flex flex-wrap gap-3 justify-center"
          >
            {bloodTypes.map((type, i) => (
              <motion.div
                key={type}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.5 + i * 0.1, duration: 0.5 }}
                className="animate-float"
                style={{ animationDelay: `${i * 0.5}s` }}
              >
                <div className="px-4 py-2 rounded-xl bg-gray-200/70 dark:bg-white/5 backdrop-blur-sm border border-gray-400/40 dark:border-white/10 text-sm font-bold text-gray-800 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-400 hover:border-red-500/40 transition-all duration-300">
                  {type}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-6 h-10 rounded-full border-2 border-gray-400 dark:border-white/20 flex justify-center pt-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </motion.div>
        </motion.div>
      </section>

      {/* ========== STATS SECTION ========== */}
      <StatsSection />

      {/* ========== GLOW DIVIDER ========== */}
      <div className="glow-line mx-auto max-w-4xl" />

      {/* ========== FEATURES SECTION ========== */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal direction="up">
            <div className="text-center mb-16">
              <span className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">Powered by Intelligence</span>
              <h2 className="mt-4 text-4xl md:text-5xl font-black text-black dark:text-white">
                8 Advanced <span className="bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 dark:from-red-400 dark:via-pink-400 dark:to-rose-400 bg-clip-text text-transparent">Modules</span>
              </h2>
              <p className="mt-4 text-gray-800 dark:text-gray-400 max-w-2xl mx-auto font-medium">
                Beyond basic CRUD — our platform uses AI, geo-spatial algorithms, and gamification
                to create a truly intelligent blood ecosystem.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.1} direction={i % 2 === 0 ? 'left' : 'right'}>
                <GlassCard className={`p-8 h-full bg-gradient-to-br ${feature.color}`} glow>
                  <div className="text-red-700 dark:text-red-400 mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-black text-black dark:text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-800 dark:text-gray-400 text-sm leading-relaxed font-medium">{feature.description}</p>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal direction="up">
            <div className="text-center mb-16">
              <span className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">Simple Process</span>
              <h2 className="mt-4 text-4xl md:text-5xl font-black text-black dark:text-white">
                How It <span className="bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 dark:from-red-400 dark:via-pink-400 dark:to-rose-400 bg-clip-text text-transparent">Works</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Check Eligibility',
                description: 'Our AI chatbot evaluates your health data — weight, hemoglobin, medical history — to determine your eligibility score.',
                icon: '🔬',
              },
              {
                step: '02',
                title: 'Book & Donate',
                description: 'Schedule an appointment at your nearest hospital. Our smart queue system predicts wait times so you never waste time.',
                icon: '📅',
              },
              {
                step: '03',
                title: 'Save Lives & Earn',
                description: 'Your donation helps save lives. Earn XP, unlock badges, climb leaderboards, and become a hero in your community.',
                icon: '🏆',
              },
            ].map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 0.2} direction="up">
                <div className="relative">
                  {/* Step number */}
                  <div className="text-8xl font-black text-black/5 dark:text-white/5 absolute -top-6 -left-2">
                    {item.step}
                  </div>
                  <GlassCard className="p-8 relative">
                    <span className="text-4xl mb-4 block">{item.icon}</span>
                    <h3 className="text-xl font-black text-black dark:text-white mb-3">{item.title}</h3>
                    <p className="text-gray-800 dark:text-gray-400 text-sm leading-relaxed font-medium">{item.description}</p>
                  </GlassCard>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA SECTION ========== */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal direction="up">
            <GlassCard className="p-12 md:p-16 text-center relative overflow-hidden" hover={false}>
              {/* Background glow */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.2)_0%,_transparent_70%)]" />

              <div className="relative z-10">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="w-20 h-20 mx-auto mb-8 rounded-full bg-gradient-to-r from-red-500 to-red-700 flex items-center justify-center shadow-2xl shadow-red-500/40"
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M12 2C12 2 4 10 4 14.5C4 18.64 7.58 22 12 22C16.42 22 20 18.64 20 14.5C20 10 12 2 12 2Z" fill="currentColor" />
                  </svg>
                </motion.div>

                <h2 className="text-3xl md:text-5xl font-black text-black dark:text-white mb-6">
                  Ready to <span className="bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 dark:from-red-400 dark:via-pink-400 dark:to-rose-400 bg-clip-text text-transparent">Save Lives?</span>
                </h2>
                <p className="text-gray-800 dark:text-gray-400 mb-8 max-w-lg mx-auto font-medium">
                  Join thousands of donors across Sri Lanka. Your one donation can save up to three lives.
                  Start your journey today.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/eligibility">
                    <GlowButton size="lg">
                      Start Eligibility Check
                    </GlowButton>
                  </Link>
                  <Link href="/campaigns">
                    <GlowButton size="lg" variant="secondary">
                      View Campaigns
                    </GlowButton>
                  </Link>
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
