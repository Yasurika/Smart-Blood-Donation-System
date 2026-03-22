'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface FormData {
    title: string;
    description: string;
    date: string;
    endDate: string;
    address: string;
    maxCapacity: number;
    bloodTypesNeeded: string[];
    image: string;
}

const initialForm: FormData = {
    title: '',
    description: '',
    date: '',
    endDate: '',
    address: '',
    maxCapacity: 100,
    bloodTypesNeeded: [],
    image: '',
};

export default function NewCampaignPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [form, setForm] = useState<FormData>(initialForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState('');

    if (status === 'loading') {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!session?.user) {
        router.replace('/login');
        return null;
    }

    const role = (session.user as { role?: string }).role;
    if (role !== 'admin' && role !== 'hospital') {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <GlassCard className="p-10 text-center max-w-md">
                    <span className="text-5xl block mb-4">🔒</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-slate-500 dark:text-gray-400 mb-6">
                        Only hospital administrators and admins can create campaigns.
                    </p>
                    <GlowButton variant="secondary" onClick={() => router.push('/dashboard')}>
                        Back to Dashboard
                    </GlowButton>
                </GlassCard>
            </div>
        );
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: name === 'maxCapacity' ? Number(value) : value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    }

    function toggleBloodType(bt: string) {
        setForm(prev => ({
            ...prev,
            bloodTypesNeeded: prev.bloodTypesNeeded.includes(bt)
                ? prev.bloodTypesNeeded.filter(t => t !== bt)
                : [...prev.bloodTypesNeeded, bt],
        }));
    }

    function validate(): boolean {
        const errs: Record<string, string> = {};

        if (!form.title || form.title.length < 3) errs.title = 'Title must be at least 3 characters';
        if (!form.description || form.description.length < 10) errs.description = 'Description must be at least 10 characters';
        if (!form.date) errs.date = 'Start date is required';
        if (!form.endDate) errs.endDate = 'End date is required';
        if (form.date && form.endDate && new Date(form.endDate) <= new Date(form.date)) {
            errs.endDate = 'End date must be after start date';
        }
        if (form.date && new Date(form.date) <= new Date()) {
            errs.date = 'Start date must be in the future';
        }
        if (!form.address || form.address.length < 5) errs.address = 'Location address must be at least 5 characters';
        if (form.maxCapacity < 1 || form.maxCapacity > 10000) errs.maxCapacity = 'Capacity must be between 1 and 10,000';
        if (form.image && !/^https?:\/\/.+/.test(form.image)) errs.image = 'Must be a valid URL';

        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setServerError('');
        if (!validate()) return;

        setSubmitting(true);
        try {
            const payload = {
                title: form.title,
                description: form.description,
                organizerId: session!.user!.id,
                location: { address: form.address },
                date: form.date,
                endDate: form.endDate,
                maxCapacity: form.maxCapacity,
                ...(form.bloodTypesNeeded.length > 0 && { bloodTypesNeeded: form.bloodTypesNeeded }),
                ...(form.image && { image: form.image }),
            };

            const res = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (!res.ok) {
                setServerError(json.error || 'Failed to create campaign');
                return;
            }

            router.push('/campaigns');
        } catch {
            setServerError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    const inputClass =
        'w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all';

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-3xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="text-center mb-10">
                        <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Organize</span>
                        <h1 className="mt-3 text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                            Create New{' '}
                            <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">
                                Campaign
                            </span>
                        </h1>
                        <p className="mt-3 text-slate-500 dark:text-gray-400 max-w-md mx-auto">
                            Set up a blood donation drive and invite donors to participate.
                        </p>
                    </div>
                </ScrollReveal>

                <ScrollReveal direction="up" delay={0.1}>
                    <GlassCard className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {serverError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm"
                                >
                                    {serverError}
                                </motion.div>
                            )}

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                                    Campaign Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="e.g. NSBM Blood Donation Drive 2026"
                                    className={inputClass}
                                    maxLength={200}
                                />
                                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                                    Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Describe the campaign goals, what to expect, any special instructions..."
                                    className={`${inputClass} resize-none`}
                                    rows={4}
                                    maxLength={2000}
                                />
                                <div className="flex justify-between mt-1">
                                    {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                                    <p className="text-xs text-slate-400 dark:text-gray-500 ml-auto">
                                        {form.description.length}/2000
                                    </p>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                                        Start Date & Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        name="date"
                                        value={form.date}
                                        onChange={handleChange}
                                        className={inputClass}
                                    />
                                    {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                                        End Date & Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        name="endDate"
                                        value={form.endDate}
                                        onChange={handleChange}
                                        className={inputClass}
                                    />
                                    {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate}</p>}
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                                    Location Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="address"
                                    value={form.address}
                                    onChange={handleChange}
                                    placeholder="e.g. NSBM Green University, Homagama, Sri Lanka"
                                    className={inputClass}
                                    maxLength={500}
                                />
                                {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
                            </div>

                            {/* Max Capacity */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                                    Maximum Capacity
                                </label>
                                <input
                                    type="number"
                                    name="maxCapacity"
                                    value={form.maxCapacity}
                                    onChange={handleChange}
                                    min={1}
                                    max={10000}
                                    className={inputClass}
                                />
                                {errors.maxCapacity && <p className="mt-1 text-xs text-red-500">{errors.maxCapacity}</p>}
                            </div>

                            {/* Blood Types Needed */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                                    Blood Types Needed <span className="text-slate-400 dark:text-gray-500 font-normal">(optional)</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {BLOOD_TYPES.map(bt => {
                                        const selected = form.bloodTypesNeeded.includes(bt);
                                        return (
                                            <button
                                                key={bt}
                                                type="button"
                                                onClick={() => toggleBloodType(bt)}
                                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                                    selected
                                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                                        : 'bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:border-red-500/50'
                                                }`}
                                            >
                                                {bt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Image URL */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                                    Campaign Image URL <span className="text-slate-400 dark:text-gray-500 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="url"
                                    name="image"
                                    value={form.image}
                                    onChange={handleChange}
                                    placeholder="https://example.com/campaign-banner.jpg"
                                    className={inputClass}
                                />
                                {errors.image && <p className="mt-1 text-xs text-red-500">{errors.image}</p>}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <GlowButton
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="flex-1"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Creating...
                                        </span>
                                    ) : (
                                        '🩸 Create Campaign'
                                    )}
                                </GlowButton>
                                <GlowButton
                                    type="button"
                                    variant="outline"
                                    size="lg"
                                    onClick={() => router.back()}
                                    disabled={submitting}
                                >
                                    Cancel
                                </GlowButton>
                            </div>
                        </form>
                    </GlassCard>
                </ScrollReveal>
            </div>
        </div>
    );
}
