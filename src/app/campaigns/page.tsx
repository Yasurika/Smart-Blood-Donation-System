'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface Campaign {
    _id: string;
    title: string;
    description: string;
    date: string;
    endDate?: string;
    location: { address: string; coordinates?: number[] };
    organizerId: string | { _id?: string; name?: string };
    maxCapacity: number;
    rsvpList: string[];
    rsvpDetails?: Array<{ id: string; name: string; bloodType: string; phone?: string }>;
    canManage?: boolean;
    isActive: boolean;
    bloodTypesNeeded?: string[];
    tags?: string[];
}

const CAMPAIGN_ICONS: Record<string, string> = {
    emergency: '🚨',
    university: '🎓',
    corporate: '🏢',
    mobile: '🚐',
    national: '🏛️',
    default: '🩸',
};

function getCampaignIcon(campaign: Campaign): string {
    const title = campaign.title.toLowerCase();
    if (title.includes('emergency') || title.includes('urgent')) return CAMPAIGN_ICONS.emergency;
    if (title.includes('university') || title.includes('campus') || title.includes('nsbm')) return CAMPAIGN_ICONS.university;
    if (title.includes('corporate') || title.includes('company')) return CAMPAIGN_ICONS.corporate;
    if (title.includes('mobile') || title.includes('clinic')) return CAMPAIGN_ICONS.mobile;
    if (title.includes('national') || title.includes('world')) return CAMPAIGN_ICONS.national;
    return CAMPAIGN_ICONS.default;
}

function isUrgent(campaign: Campaign): boolean {
    const title = campaign.title.toLowerCase();
    return title.includes('emergency') || title.includes('urgent') || (campaign.tags || []).includes('emergency');
}

export default function CampaignsPage() {
    const { data: session } = useSession();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        date: '',
        endDate: '',
        address: '',
        maxCapacity: 100,
    });
    const [editError, setEditError] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const role = session?.user?.role;
    const canCreateCampaign = role === 'hospital' || role === 'admin';

    useEffect(() => {
        async function fetchCampaigns() {
            try {
                const res = await fetch('/api/campaigns?upcoming=true&limit=20');
                if (res.ok) {
                    const json = await res.json();
                    setCampaigns(json.data || []);
                }
            } catch (err) {
                console.error('Failed to fetch campaigns:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchCampaigns();
    }, []);

    const handleRSVP = async (campaignId: string) => {
        try {
            const res = await fetch(`/api/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsvp: true }),
            });
            if (res.ok) {
                setCampaigns(prev =>
                    prev.map(c => c._id === campaignId
                        ? { ...c, rsvpList: [...c.rsvpList, 'self'] }
                        : c
                    )
                );
            }
        } catch (err) {
            console.error('RSVP failed:', err);
        }
    };

    const openEditModal = (campaign: Campaign) => {
        setEditError('');
        setEditingCampaign(campaign);
        setEditForm({
            title: campaign.title,
            description: campaign.description,
            date: campaign.date ? new Date(campaign.date).toISOString().slice(0, 16) : '',
            endDate: campaign.endDate ? new Date(campaign.endDate).toISOString().slice(0, 16) : '',
            address: campaign.location?.address || '',
            maxCapacity: campaign.maxCapacity || 100,
        });
    };

    const handleSaveEdit = async () => {
        if (!editingCampaign) return;

        if (!editForm.title.trim() || !editForm.description.trim() || !editForm.date || !editForm.endDate || !editForm.address.trim()) {
            setEditError('Please fill all required fields.');
            return;
        }

        if (new Date(editForm.endDate) <= new Date(editForm.date)) {
            setEditError('End date must be after start date.');
            return;
        }

        setSavingEdit(true);
        setEditError('');

        try {
            const res = await fetch(`/api/campaigns/${editingCampaign._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editForm.title,
                    description: editForm.description,
                    date: editForm.date,
                    endDate: editForm.endDate,
                    location: { address: editForm.address },
                    maxCapacity: Number(editForm.maxCapacity),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setEditError(data.error || 'Failed to update campaign');
                return;
            }

            setEditingCampaign(null);
            const refreshed = await fetch('/api/campaigns?upcoming=true&limit=20');
            if (refreshed.ok) {
                const json = await refreshed.json();
                setCampaigns(json.data || []);
            }
        } catch {
            setEditError('Network error while updating campaign.');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteCampaign = async (campaignId: string) => {
        if (!window.confirm('Delete this campaign?')) return;

        setDeletingId(campaignId);
        try {
            const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
            if (res.ok) {
                setCampaigns((prev) => prev.filter((c) => c._id !== campaignId));
            }
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-28 px-6 pb-20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-6xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="text-center mb-12">
                        <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Blood Drives</span>
                        <h1 className="mt-4 text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                            Upcoming <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Campaigns</span>
                        </h1>
                        <p className="mt-4 text-slate-500 dark:text-gray-400 max-w-lg mx-auto">
                            Join a blood donation campaign near you. RSVP to reserve your spot.
                        </p>
                    </div>
                </ScrollReveal>

                {campaigns.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {campaigns.map((campaign, i) => {
                            const urgent = isUrgent(campaign);
                            const icon = getCampaignIcon(campaign);
                            const rsvpCount = campaign.rsvpList?.length || 0;
                            const rsvpPct = campaign.maxCapacity > 0 ? (rsvpCount / campaign.maxCapacity) * 100 : 0;

                            return (
                                <ScrollReveal key={campaign._id} delay={i * 0.1} direction="up">
                                    <GlassCard className="p-0 overflow-hidden h-full flex flex-col">
                                        <div className={`relative h-40 flex items-center justify-center ${urgent
                                            ? 'bg-gradient-to-br from-red-500/20 to-red-800/10'
                                            : 'bg-gradient-to-br from-slate-200/50 to-slate-100/20 dark:from-gray-800/50 dark:to-gray-900/20'
                                        }`}>
                                            <span className="text-6xl">{icon}</span>
                                            {urgent && (
                                                <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-red-500/30 text-red-500 dark:text-red-300 text-xs font-semibold animate-pulse">
                                                    🚨 URGENT
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-6 flex-1 flex flex-col">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{campaign.title}</h3>
                                            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4 flex-1 line-clamp-3">{campaign.description}</p>

                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                                    </svg>
                                                    {new Date(campaign.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                                                    </svg>
                                                    {typeof campaign.location === 'object' ? campaign.location.address : campaign.location}
                                                </div>
                                            </div>

                                            {campaign.maxCapacity > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex justify-between text-xs text-slate-400 dark:text-gray-500 mb-1">
                                                        <span>{rsvpCount} RSVPs</span>
                                                        <span>{campaign.maxCapacity} capacity</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                                                            initial={{ width: 0 }}
                                                            whileInView={{ width: `${Math.min(100, rsvpPct)}%` }}
                                                            transition={{ duration: 1, delay: 0.3 }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {campaign.bloodTypesNeeded && campaign.bloodTypesNeeded.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-4">
                                                    {campaign.bloodTypesNeeded.map(bt => (
                                                        <span key={bt} className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 text-xs font-medium">
                                                            {bt}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <GlowButton
                                                variant={urgent ? 'danger' : 'primary'}
                                                size="sm"
                                                className="w-full"
                                                onClick={() => handleRSVP(campaign._id)}
                                            >
                                                RSVP Now
                                            </GlowButton>

                                            {campaign.canManage && (
                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                    <GlowButton
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => openEditModal(campaign)}
                                                    >
                                                        ✏️ Edit
                                                    </GlowButton>
                                                    <GlowButton
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => handleDeleteCampaign(campaign._id)}
                                                        disabled={deletingId === campaign._id}
                                                    >
                                                        {deletingId === campaign._id ? 'Deleting...' : '🗑️ Delete'}
                                                    </GlowButton>
                                                </div>
                                            )}

                                            {(campaign.rsvpDetails?.length || 0) > 0 && (
                                                <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                                    <p className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-2">People who RSVPed</p>
                                                    <div className="space-y-1">
                                                        {campaign.rsvpDetails!.map((person) => (
                                                            <p key={person.id} className="text-xs text-slate-600 dark:text-gray-400">
                                                                {person.name} ({person.bloodType}){person.phone ? ` • ${person.phone}` : ''}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </GlassCard>
                                </ScrollReveal>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <span className="text-6xl block mb-4">📢</span>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Upcoming Campaigns</h3>
                        <p className="text-slate-500 dark:text-gray-400">Check back soon for new blood donation drives in your area.</p>
                    </div>
                )}

                {canCreateCampaign && (
                    <ScrollReveal direction="up" className="mt-12">
                        <GlassCard className="p-8 text-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Want to Organize a Campaign?</h2>
                            <p className="text-slate-500 dark:text-gray-400 mb-6">Create and manage blood donation events for your organization.</p>
                            <Link href="/dashboard/campaigns/new">
                                <GlowButton variant="outline">Create Campaign</GlowButton>
                            </Link>
                        </GlassCard>
                    </ScrollReveal>
                )}

                <AnimatePresence>
                    {editingCampaign && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                                className="w-full max-w-2xl"
                            >
                                <GlassCard className="p-6">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Edit Campaign</h3>

                                    {editError && <p className="text-sm text-red-500 mb-3">{editError}</p>}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input
                                            value={editForm.title}
                                            onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                                            placeholder="Title"
                                            className="px-3 py-2 rounded-lg bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                        />
                                        <input
                                            value={editForm.address}
                                            onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                                            placeholder="Location address"
                                            className="px-3 py-2 rounded-lg bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                        />
                                        <input
                                            type="datetime-local"
                                            value={editForm.date}
                                            onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                                            className="px-3 py-2 rounded-lg bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                        />
                                        <input
                                            type="datetime-local"
                                            value={editForm.endDate}
                                            onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))}
                                            className="px-3 py-2 rounded-lg bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                        />
                                        <input
                                            type="number"
                                            min={1}
                                            value={editForm.maxCapacity}
                                            onChange={(e) => setEditForm((p) => ({ ...p, maxCapacity: Number(e.target.value || 0) }))}
                                            placeholder="Max capacity"
                                            className="px-3 py-2 rounded-lg bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                        />
                                        <div className="md:col-span-2">
                                            <textarea
                                                value={editForm.description}
                                                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                                                placeholder="Description"
                                                rows={4}
                                                className="w-full px-3 py-2 rounded-lg bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <GlowButton onClick={handleSaveEdit} disabled={savingEdit}>
                                            {savingEdit ? 'Saving...' : 'Save Changes'}
                                        </GlowButton>
                                        <GlowButton variant="outline" onClick={() => setEditingCampaign(null)}>
                                            Cancel
                                        </GlowButton>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
