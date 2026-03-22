'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import { useRouter } from 'next/navigation';

interface Request {
    id: string;
    hospitalId: string;
    hospital: string;
    hospitalAddress?: string;
    hospitalPhone?: string;
    bloodType: string;
    units: number;
    urgency: string;
    time: string;
    respondedDonors: number;
    respondedDonorDetails?: Array<{
        id: string;
        name: string;
        bloodType: string;
        phone?: string;
    }>;
    canManage?: boolean;
    notes?: string;
    location?: { coordinates: [number, number] };
}

interface RequestsClientProps {
    requests: Request[];
    userRole: string;
}

export default function RequestsClient({ requests, userRole }: RequestsClientProps) {
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingRequest, setEditingRequest] = useState<Request | null>(null);
    const [editForm, setEditForm] = useState({ units: '', urgency: 'Critical', notes: '' });
    const [editError, setEditError] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [respondingId, setRespondingId] = useState<string | null>(null);
    const [responseMsg, setResponseMsg] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null);
    const [formData, setFormData] = useState({ bloodType: '', units: '', urgency: 'Critical', notes: '' });

    const handleCreate = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/blood-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setCreating(false);
                setFormData({ bloodType: '', units: '', urgency: 'Critical', notes: '' });
                router.refresh();
            } else {
                alert('Failed to create request');
            }
        } catch (error) {
            console.error(error);
            alert('Error creating request');
        } finally {
            setLoading(false);
        }
    };

    const handleDonate = async (requestId: string) => {
        setRespondingId(requestId);
        setResponseMsg(null);
        try {
            const res = await fetch(`/api/blood-requests/${requestId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await res.json();
            if (res.ok) {
                setResponseMsg({ id: requestId, msg: data.data?.message || 'Response recorded successfully!', type: 'success' });
                router.refresh();
            } else {
                setResponseMsg({ id: requestId, msg: data.error || 'Failed to respond', type: 'error' });
            }
        } catch {
            setResponseMsg({ id: requestId, msg: 'Network error. Please try again.', type: 'error' });
        } finally {
            setRespondingId(null);
        }
    };

    const handleEdit = (req: Request) => {
        setEditError('');
        setEditingRequest(req);
        setEditForm({
            units: String(req.units),
            urgency: req.urgency,
            notes: req.notes || '',
        });
    };

    const handleEditSubmit = async () => {
        if (!editingRequest) return;

        const units = Number(editForm.units);
        const urgency = editForm.urgency.trim();

        if (!Number.isFinite(units) || units <= 0) {
            setEditError('Units must be a positive number.');
            return;
        }

        if (!['Critical', 'High', 'Medium', 'Low'].includes(urgency)) {
            setEditError('Urgency must be one of: Critical, High, Medium, Low.');
            return;
        }

        setEditError('');
        setEditingId(editingRequest.id);
        try {
            const res = await fetch(`/api/blood-requests/${editingRequest.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    units,
                    urgency,
                    notes: editForm.notes,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setEditError(data.error || 'Failed to update request');
                return;
            }

            setEditingRequest(null);
            router.refresh();
        } catch {
            setEditError('Network error while updating request.');
        } finally {
            setEditingId(null);
        }
    };

    const handleDelete = async (requestId: string) => {
        if (!window.confirm('Cancel this emergency request?')) return;

        setDeletingId(requestId);
        try {
            const res = await fetch(`/api/blood-requests/${requestId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Failed to delete request');
                return;
            }

            router.refresh();
        } catch {
            alert('Network error while deleting request.');
        } finally {
            setDeletingId(null);
        }
    };

    const openMap = (req: Request) => {
        const coords = req.location?.coordinates;
        if (coords && coords[0] !== 0 && coords[1] !== 0) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`, '_blank');
        } else if (req.hospitalAddress) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(req.hospitalAddress)}`, '_blank');
        } else {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(req.hospital)}`, '_blank');
        }
    };

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-6xl mx-auto">
                <ScrollReveal direction="up">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-4">
                        <div>
                            <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Emergency</span>
                            <h1 className="mt-2 text-3xl md:text-4xl font-bold text-white">
                                Blood <span className="gradient-text">Requests</span>
                            </h1>
                            <p className="mt-2 text-gray-400">Active emergency blood requests across the network.</p>
                        </div>
                        {userRole === 'hospital' && (
                            <GlowButton variant="danger" onClick={() => setCreating(!creating)}>
                                🚨 New Emergency Request
                            </GlowButton>
                        )}
                    </div>
                </ScrollReveal>

                {/* Create Form */}
                {creating && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-8">
                        <GlassCard className="p-8 border-red-500/30 bg-red-900/10">
                            <h2 className="text-xl font-bold text-white mb-6">🚨 Create Emergency Request</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-300 mb-2">Blood Type Needed</label>
                                    <select
                                        value={formData.bloodType}
                                        onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-red-500/50 focus:outline-none"
                                    >
                                        <option value="" className="bg-gray-900">Select blood type</option>
                                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
                                            <option key={t} value={t} className="bg-gray-900">{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-300 mb-2">Units Needed</label>
                                    <input
                                        type="number"
                                        value={formData.units}
                                        onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                                        placeholder="e.g. 3"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-red-500/50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-300 mb-2">Urgency Level</label>
                                    <select
                                        value={formData.urgency}
                                        onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-red-500/50 focus:outline-none"
                                    >
                                        {['Critical', 'High', 'Medium', 'Low'].map((u) => (
                                            <option key={u} value={u} className="bg-gray-900">{u}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-300 mb-2">Additional Notes</label>
                                    <input
                                        type="text"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="e.g. Emergency surgery patient"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-red-500/50 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <GlowButton variant="danger" onClick={handleCreate} disabled={loading}>
                                    {loading ? 'Sending...' : 'Send Emergency Request'}
                                </GlowButton>
                                <GlowButton variant="outline" onClick={() => setCreating(false)}>Cancel</GlowButton>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}

                {/* Edit Form Modal */}
                <AnimatePresence>
                    {editingRequest && (
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
                                className="w-full max-w-xl"
                            >
                                <GlassCard className="p-8 border-red-500/30 bg-red-900/10">
                                    <h2 className="text-xl font-bold text-white mb-6">✏️ Edit Emergency Request</h2>

                                    {editError && (
                                        <p className="text-sm text-red-400 mb-4">{editError}</p>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-300 mb-2">Units Needed</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={editForm.units}
                                                onChange={(e) => setEditForm((prev) => ({ ...prev, units: e.target.value }))}
                                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-red-500/50 focus:outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-gray-300 mb-2">Urgency Level</label>
                                            <select
                                                value={editForm.urgency}
                                                onChange={(e) => setEditForm((prev) => ({ ...prev, urgency: e.target.value }))}
                                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-red-500/50 focus:outline-none"
                                            >
                                                {['Critical', 'High', 'Medium', 'Low'].map((u) => (
                                                    <option key={u} value={u} className="bg-gray-900">{u}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm text-gray-300 mb-2">Additional Notes</label>
                                            <input
                                                type="text"
                                                value={editForm.notes}
                                                onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-red-500/50 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6">
                                        <GlowButton
                                            variant="primary"
                                            onClick={handleEditSubmit}
                                            disabled={editingId === editingRequest.id}
                                        >
                                            {editingId === editingRequest.id ? 'Saving...' : 'Save Changes'}
                                        </GlowButton>
                                        <GlowButton
                                            variant="outline"
                                            onClick={() => {
                                                setEditingRequest(null);
                                                setEditError('');
                                            }}
                                        >
                                            Cancel
                                        </GlowButton>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Active Requests */}
                <div className="space-y-4">
                    {requests.length > 0 ? requests.map((req, i) => (
                        <ScrollReveal key={req.id} delay={i * 0.1} direction="up">
                            <GlassCard className={`p-6 ${req.urgency === 'Critical' ? 'border-red-500/30' : ''}`}>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${req.urgency === 'Critical' ? 'bg-red-500/20 pulse-glow' : 'bg-white/5'
                                            }`}>
                                            <span className="text-2xl font-black text-red-400">{req.bloodType}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">{req.hospital}</h3>
                                            <p className="text-sm text-gray-400">{req.units} units needed • {req.time}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.urgency === 'Critical' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                                                    req.urgency === 'High' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                    {req.urgency}
                                                </span>
                                                <span className="text-xs text-gray-500">{req.respondedDonors} donors responded</span>
                                                {req.notes && <span className="text-xs text-gray-500 italic">• {req.notes}</span>}
                                            </div>
                                            {(userRole === 'hospital' || userRole === 'admin') && (req.respondedDonorDetails?.length || 0) > 0 && (
                                                <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                                    <p className="text-xs font-semibold text-gray-300 mb-2">Responded Donors</p>
                                                    <div className="space-y-1">
                                                        {req.respondedDonorDetails!.map((donor) => (
                                                            <p key={donor.id} className="text-xs text-gray-400">
                                                                {donor.name} ({donor.bloodType}){donor.phone ? ` • ${donor.phone}` : ''}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            {userRole === 'donor' && (
                                                <GlowButton
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => handleDonate(req.id)}
                                                    disabled={respondingId === req.id}
                                                >
                                                    {respondingId === req.id ? '⏳ Sending...' : '🩸 I Can Donate'}
                                                </GlowButton>
                                            )}
                                            <GlowButton variant="outline" size="sm" onClick={() => openMap(req)}>
                                                🗺️ View on Map
                                            </GlowButton>
                                            {req.canManage && (
                                                <>
                                                    <GlowButton
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => handleEdit(req)}
                                                        disabled={editingId === req.id}
                                                    >
                                                        {editingId === req.id ? 'Saving...' : '✏️ Edit'}
                                                    </GlowButton>
                                                    <GlowButton
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => handleDelete(req.id)}
                                                        disabled={deletingId === req.id}
                                                    >
                                                        {deletingId === req.id ? 'Deleting...' : '🗑️ Delete'}
                                                    </GlowButton>
                                                </>
                                            )}
                                        </div>
                                        <AnimatePresence>
                                            {responseMsg && responseMsg.id === req.id && (
                                                <motion.p
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    className={`text-xs ${responseMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
                                                >
                                                    {responseMsg.msg}
                                                </motion.p>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </GlassCard>
                        </ScrollReveal>
                    )) : (
                        <div className="text-center py-20 text-gray-500">
                            No active emergency requests at the moment.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
