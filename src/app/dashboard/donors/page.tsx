'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface Donor {
    _id: string;
    name: string;
    email: string;
    nicNumber?: string;
    bloodType: string;
    phone: string;
    address: string;
    district?: string;
    gender?: 'male' | 'female';
    dateOfBirth?: string;
    weight: number;
    xp: number;
    totalDonations: number;
    lastDonationDate?: string;
    isActive: boolean;
    createdAt: string;
}

interface DonorEditForm {
    name: string;
    phone: string;
    address: string;
    weight: number;
    bloodType: string;
    nicNumber: string;
    district: string;
    gender: '' | 'male' | 'female';
    dateOfBirth: string;
}

interface DonorRegistrationForm {
    name: string;
    nicNumber: string;
    bloodType: string;
    phone: string;
    address: string;
    weight: number;
    district: string;
    gender: '' | 'male' | 'female';
    dateOfBirth: string;
    email: string;
    nicImageUrl: string;
}

function getTier(xp: number) {
    if (xp >= 5000) return { label: 'Platinum', color: 'text-purple-400', bg: 'bg-purple-500/10' };
    if (xp >= 2000) return { label: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    if (xp >= 500) return { label: 'Silver', color: 'text-slate-300', bg: 'bg-slate-400/10' };
    return { label: 'Bronze', color: 'text-orange-400', bg: 'bg-orange-500/10' };
}

function getBloodTypeColor(bt: string) {
    const colors: Record<string, string> = {
        'O+': 'bg-red-500/15 text-red-500', 'O-': 'bg-red-600/15 text-red-600',
        'A+': 'bg-blue-500/15 text-blue-500', 'A-': 'bg-blue-600/15 text-blue-600',
        'B+': 'bg-green-500/15 text-green-500', 'B-': 'bg-green-600/15 text-green-600',
        'AB+': 'bg-purple-500/15 text-purple-500', 'AB-': 'bg-purple-600/15 text-purple-600',
    };
    return colors[bt] || 'bg-gray-500/15 text-gray-500';
}

function normalizeOcrText(text: string) {
    return text.replace(/\r/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

function isValidNicDayCode(dayCode: number) {
    return (dayCode >= 1 && dayCode <= 366) || (dayCode >= 501 && dayCode <= 866);
}

function findNicNumberFromText(text: string) {
    const upper = text.toUpperCase();
    const compact = upper.replace(/[^A-Z0-9]/g, '');
    const normalizedCompact = compact
        .replace(/O/g, '0')
        .replace(/[IL]/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8');

    const oldNic = normalizedCompact.match(/\d{9}[VX]/);
    if (oldNic) return oldNic[0];

    const separatedMatches = upper.match(/(?:\d[\s.\-]*){12}/g) || [];
    for (const m of separatedMatches) {
        const candidate = m.replace(/\D/g, '');
        if (candidate.length !== 12) continue;

        const year = Number(candidate.slice(0, 4));
        const dayCode = Number(candidate.slice(4, 7));
        if (year >= 1900 && year <= 2099 && isValidNicDayCode(dayCode)) {
            return candidate;
        }
    }

    const plainTwelve = normalizedCompact.match(/\d{12}/g) || [];
    for (const candidate of plainTwelve) {
        const year = Number(candidate.slice(0, 4));
        const dayCode = Number(candidate.slice(4, 7));
        if (year >= 1900 && year <= 2099 && isValidNicDayCode(dayCode)) {
            return candidate;
        }
    }

    return undefined;
}

function toIsoDate(year: number, dayOfYear: number) {
    const date = new Date(Date.UTC(year, 0, dayOfYear));
    if (Number.isNaN(date.getTime())) return undefined;

    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${date.getUTCFullYear()}-${month}-${day}`;
}

function parseNicDetailsFromNumber(nicNumber?: string) {
    if (!nicNumber) return {} as { nicNumber?: string; dateOfBirth?: string; gender?: 'male' | 'female' };

    const nic = nicNumber.toUpperCase();
    if (/^\d{12}$/.test(nic)) {
        const year = Number(nic.slice(0, 4));
        let dayCode = Number(nic.slice(4, 7));
        const gender: 'male' | 'female' = dayCode > 500 ? 'female' : 'male';
        if (dayCode > 500) dayCode -= 500;
        return { nicNumber: nic, dateOfBirth: toIsoDate(year, dayCode), gender };
    }

    if (/^\d{9}[VX]$/.test(nic)) {
        const yearPrefix = Number(nic.slice(0, 2));
        const year = yearPrefix > 30 ? 1900 + yearPrefix : 2000 + yearPrefix;
        let dayCode = Number(nic.slice(2, 5));
        const gender: 'male' | 'female' = dayCode > 500 ? 'female' : 'male';
        if (dayCode > 500) dayCode -= 500;
        return { nicNumber: nic, dateOfBirth: toIsoDate(year, dayCode), gender };
    }

    return { nicNumber: nic };
}

function parseDateString(dateText: string) {
    const cleaned = dateText.trim();
    const parts = cleaned.split(/[./-]/);
    if (parts.length !== 3) return undefined;

    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);
    if (!day || !month || !year) return undefined;

    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) return undefined;

    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

function parseExtraFields(text: string) {
    const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const upperText = text.toUpperCase();

    let name: string | undefined;
    const nameLineIndex = lines.findIndex(line => /^1\s*,\s*2\s*\.?/i.test(line));
    if (nameLineIndex >= 0) {
        const collected: string[] = [];
        for (let i = nameLineIndex; i < Math.min(lines.length, nameLineIndex + 3); i++) {
            if (/^\d+\s*[A-Za-z]?\s*[.,]/.test(lines[i]) && i !== nameLineIndex) break;
            collected.push(lines[i]);
        }

        const merged = collected
            .join(' ')
            .replace(/^1\s*,\s*2\s*\.?\s*/i, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (merged) name = merged;
    }

    let dateOfBirth: string | undefined;
    const dobMatch = upperText.match(/\b\d{2}[./-]\d{2}[./-]\d{4}\b/);
    if (dobMatch) dateOfBirth = parseDateString(dobMatch[0]);

    let bloodType: string | undefined;
    const bloodGroupMatch = upperText.match(/BLOOD\s*GROUP\s*[:\-]?\s*(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)/i);
    if (bloodGroupMatch) bloodType = bloodGroupMatch[1].toUpperCase();

    let address: string | undefined;
    const addressLineIndex = lines.findIndex(line => /^8\s*\.?/i.test(line));
    if (addressLineIndex >= 0) {
        const addressParts: string[] = [];
        for (let i = addressLineIndex; i < Math.min(lines.length, addressLineIndex + 3); i++) {
            if (/^\d+\s*[A-Za-z]?\s*[.,]/.test(lines[i]) && i !== addressLineIndex) break;
            addressParts.push(lines[i]);
        }
        const mergedAddress = addressParts
            .join(' ')
            .replace(/^8\s*\.?\s*/i, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (mergedAddress) address = mergedAddress;
    }

    return { name, dateOfBirth, bloodType, address };
}

function withClientTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

function normalizeNicInput(value?: string) {
    if (!value) return '';
    return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
}

function normalizePhoneInput(value?: string) {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim();
}

export default function DonorsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [donors, setDonors] = useState<Donor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [bloodTypeFilter, setBloodTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
    const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
    const [editForm, setEditForm] = useState<DonorEditForm>({
        name: '',
        phone: '',
        address: '',
        weight: 50,
        bloodType: 'O+',
        nicNumber: '',
        district: '',
        gender: '',
        dateOfBirth: '',
    });
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [registrationError, setRegistrationError] = useState('');
    const [registrationInfo, setRegistrationInfo] = useState('');
    const [nicOcrLoading, setNicOcrLoading] = useState(false);
    const [registrationForm, setRegistrationForm] = useState<DonorRegistrationForm>({
        name: '',
        nicNumber: '',
        bloodType: 'O+',
        phone: '',
        address: '',
        weight: 50,
        district: '',
        gender: '',
        dateOfBirth: '',
        email: '',
        nicImageUrl: '',
    });
    const [savingEdit, setSavingEdit] = useState(false);
    const [awardPoints, setAwardPoints] = useState(100);
    const [awardingPoints, setAwardingPoints] = useState(false);
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');
    const [loadingDonorDetails, setLoadingDonorDetails] = useState(false);
    const canManage = session?.user?.role === 'hospital' || session?.user?.role === 'admin';

    const updateDonorInState = useCallback((updated: Donor) => {
        setDonors(prev => prev.map(d => (d._id === updated._id ? updated : d)));
        setSelectedDonor(prev => (prev && prev._id === updated._id ? updated : prev));
    }, []);

    const fetchDonors = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '12' });
            if (search) params.set('search', search);
            if (bloodTypeFilter) params.set('bloodType', bloodTypeFilter);

            const res = await fetch(`/api/donors?${params}`);
            if (res.ok) {
                const json = await res.json();
                setDonors(json.data || []);
                const meta = json.meta || json.pagination;
                setTotalPages(meta?.totalPages || 1);
                setTotal(meta?.total || 0);
            }
        } catch (err) {
            console.error('Failed to fetch donors:', err);
        } finally {
            setLoading(false);
        }
    }, [page, search, bloodTypeFilter]);

    useEffect(() => {
        fetchDonors();
    }, [fetchDonors]);

    // Debounce search
    useEffect(() => {
        setPage(1);
    }, [search, bloodTypeFilter]);

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

    if (session.user.role === 'donor') {
        router.replace('/dashboard');
        return null;
    }

    const openEditForm = (donor: Donor) => {
        setActionError('');
        setActionSuccess('');
        setEditingDonor(donor);
        setEditForm({
            name: donor.name,
            phone: donor.phone,
            address: donor.address,
            weight: donor.weight,
            bloodType: donor.bloodType,
            nicNumber: donor.nicNumber || '',
            district: donor.district || '',
            gender: donor.gender || '',
            dateOfBirth: donor.dateOfBirth ? new Date(donor.dateOfBirth).toISOString().slice(0, 10) : '',
        });
    };

    const openDonorDetails = async (donor: Donor) => {
        setActionError('');
        setActionSuccess('');
        setSelectedDonor(donor);
        setLoadingDonorDetails(true);

        try {
            const res = await fetch(`/api/donors/${donor._id}`);
            const json = await res.json();
            if (res.ok && json.success && json.data) {
                updateDonorInState(json.data as Donor);
            }
        } catch {
            // Keep list-level donor data if detail fetch fails.
        } finally {
            setLoadingDonorDetails(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingDonor) return;

        setSavingEdit(true);
        setActionError('');
        setActionSuccess('');

        try {
            const normalizedNic = normalizeNicInput(editForm.nicNumber);
            const normalizedPhone = normalizePhoneInput(editForm.phone);
            const payload = {
                ...editForm,
                phone: normalizedPhone,
                nicNumber: normalizedNic || undefined,
                district: editForm.district || undefined,
                gender: editForm.gender || undefined,
                dateOfBirth: editForm.dateOfBirth || undefined,
            };

            const res = await fetch(`/api/donors/${editingDonor._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                if (Array.isArray(json.errors) && json.errors.length > 0) {
                    const details = json.errors
                        .map((e: { field?: string; message?: string }) => `${e.field || 'field'}: ${e.message || 'invalid value'}`)
                        .join(' | ');
                    throw new Error(details);
                }
                throw new Error(json.error || 'Failed to update donor');
            }

            updateDonorInState(json.data as Donor);
            setEditingDonor(null);
            setActionSuccess('Donor details updated successfully.');
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Failed to update donor');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleAwardDonorPoints = async (markDonation: boolean) => {
        if (!selectedDonor) return;

        setAwardingPoints(true);
        setActionError('');
        setActionSuccess('');

        try {
            const res = await fetch(`/api/donors/${selectedDonor._id}/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points: awardPoints, markDonation }),
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Failed to award points');
            }

            updateDonorInState(json.data as Donor);
            setActionSuccess(markDonation
                ? `Recorded donation and awarded ${awardPoints} XP.`
                : `Awarded ${awardPoints} XP successfully.`);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Failed to award points');
        } finally {
            setAwardingPoints(false);
        }
    };

    const resetRegistrationForm = () => {
        setRegistrationForm({
            name: '',
            nicNumber: '',
            bloodType: 'O+',
            phone: '',
            address: '',
            weight: 50,
            district: '',
            gender: '',
            dateOfBirth: '',
            email: '',
            nicImageUrl: '',
        });
        setRegistrationError('');
        setRegistrationInfo('');
    };

    const handleRegisterDonor = async () => {
        setRegistrationError('');
        setRegistering(true);

        try {
            const normalizedNic = normalizeNicInput(registrationForm.nicNumber);
            const payload = {
                ...registrationForm,
                nicNumber: normalizedNic,
                gender: registrationForm.gender || null,
                district: registrationForm.district || null,
                dateOfBirth: registrationForm.dateOfBirth || null,
                email: registrationForm.email || null,
                nicImageUrl: registrationForm.nicImageUrl || null,
            };

            const res = await fetch('/api/donors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                if (Array.isArray(json.errors) && json.errors.length > 0) {
                    const details = json.errors
                        .map((e: { field?: string; message?: string }) => `${e.field || 'field'}: ${e.message || 'invalid value'}`)
                        .join(' | ');
                    throw new Error(details);
                }
                throw new Error(json.error || 'Failed to register donor');
            }

            setShowRegisterModal(false);
            resetRegistrationForm();
            setActionSuccess('New donor registered successfully.');
            fetchDonors();
        } catch (error) {
            setRegistrationError(error instanceof Error ? error.message : 'Failed to register donor');
        } finally {
            setRegistering(false);
        }
    };

    const handleNicImageUpload = async (file?: File | null) => {
        if (!file) return;

        setNicOcrLoading(true);
        setRegistrationError('');
        setRegistrationInfo('');
        try {
            const tesseract = await import('tesseract.js');
            const ocrResult = await withClientTimeout(
                tesseract.recognize(file, 'eng'),
                25_000,
                'OCR took too long. Please use a clearer/smaller image.'
            );

            const rawText = normalizeOcrText(ocrResult.data?.text || '');
            const nicNumber = findNicNumberFromText(rawText);
            const nicParsed = parseNicDetailsFromNumber(nicNumber);
            const extraParsed = parseExtraFields(rawText);

            const extracted = {
                ...nicParsed,
                ...extraParsed,
            };
            const hasUsefulData = Boolean(
                extracted.nicNumber ||
                extracted.dateOfBirth ||
                extracted.gender ||
                extracted.name ||
                extracted.bloodType ||
                extracted.address
            );

            setRegistrationForm(prev => ({
                ...prev,
                nicNumber: extracted.nicNumber || prev.nicNumber,
                dateOfBirth: extracted.dateOfBirth || prev.dateOfBirth,
                gender: extracted.gender || prev.gender,
                name: extracted.name || prev.name,
                bloodType: extracted.bloodType || prev.bloodType,
                address: extracted.address || prev.address,
                nicImageUrl: file.name,
            }));

            if (hasUsefulData) {
                setRegistrationInfo('NIC details extracted successfully. Please verify and complete missing fields.');
            } else {
                setRegistrationError('Image was read, but no clear NIC details were detected. Please fill manually or upload a clearer image.');
            }
        } catch (error) {
            setRegistrationError(error instanceof Error ? error.message : 'Failed to extract NIC details');
        } finally {
            setNicOcrLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <ScrollReveal direction="up">
                    <div className="text-center mb-10">
                        <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">Directory</span>
                        <h1 className="mt-3 text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                            Registered{' '}
                            <span className="bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">
                                Donors
                            </span>
                        </h1>
                        <p className="mt-3 text-slate-500 dark:text-gray-400 max-w-md mx-auto">
                            Browse and manage all registered blood donors in the system.
                        </p>
                        {canManage && (
                            <div className="mt-5">
                                <GlowButton
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                        resetRegistrationForm();
                                        setShowRegisterModal(true);
                                    }}
                                >
                                    + Register Walk-in Donor
                                </GlowButton>
                            </div>
                        )}
                    </div>
                </ScrollReveal>

                {/* Stats Row */}
                <ScrollReveal direction="up" delay={0.05}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <GlassCard className="p-4 text-center">
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Total Donors</p>
                        </GlassCard>
                        <GlassCard className="p-4 text-center">
                            <p className="text-2xl font-bold text-green-500">
                                {donors.filter(d => {
                                    if (!d.lastDonationDate) return true;
                                    const daysSince = (Date.now() - new Date(d.lastDonationDate).getTime()) / 86400000;
                                    return daysSince >= 56;
                                }).length}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Eligible Now</p>
                        </GlassCard>
                        <GlassCard className="p-4 text-center">
                            <p className="text-2xl font-bold text-yellow-500">
                                {donors.reduce((sum, d) => sum + d.totalDonations, 0)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Total Donations</p>
                        </GlassCard>
                        <GlassCard className="p-4 text-center">
                            <p className="text-2xl font-bold text-purple-500">
                                {donors.filter(d => d.xp >= 2000).length}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Gold+ Tier</p>
                        </GlassCard>
                    </div>
                </ScrollReveal>

                {/* Search & Filters */}
                <ScrollReveal direction="up" delay={0.1}>
                    <GlassCard className="p-4 mb-8">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search by name, NIC, email, or address..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setBloodTypeFilter('')}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                        !bloodTypeFilter
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                            : 'bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400'
                                    }`}
                                >
                                    All
                                </button>
                                {BLOOD_TYPES.map(bt => (
                                    <button
                                        key={bt}
                                        onClick={() => setBloodTypeFilter(bt === bloodTypeFilter ? '' : bt)}
                                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                            bloodTypeFilter === bt
                                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                                : 'bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:border-red-500/50'
                                        }`}
                                    >
                                        {bt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </GlassCard>
                </ScrollReveal>

                {/* Donors Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                    </div>
                ) : donors.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {donors.map((donor, i) => {
                                const tier = getTier(donor.xp);
                                const daysSinceDonation = donor.lastDonationDate
                                    ? Math.floor((Date.now() - new Date(donor.lastDonationDate).getTime()) / 86400000)
                                    : null;
                                const eligible = daysSinceDonation === null || daysSinceDonation >= 56;

                                return (
                                    <ScrollReveal key={donor._id} delay={i * 0.05} direction="up">
                                        <motion.div
                                            whileHover={{ y: -4 }}
                                            transition={{ duration: 0.2 }}
                                            onClick={() => openDonorDetails(donor)}
                                            className="cursor-pointer"
                                        >
                                            <GlassCard className="p-5" hover>
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                            {donor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{donor.name}</h3>
                                                            <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{donor.email}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getBloodTypeColor(donor.bloodType)}`}>
                                                        {donor.bloodType}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-3 gap-3 mb-3">
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-slate-900 dark:text-white">{donor.totalDonations}</p>
                                                        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">Donations</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-slate-900 dark:text-white">{donor.xp}</p>
                                                        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">XP</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className={`text-lg font-bold ${tier.color}`}>{tier.label}</p>
                                                        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">Tier</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-3 border-t border-slate-200/50 dark:border-white/5">
                                                    <span className="text-xs text-slate-400 dark:text-gray-500">
                                                        {daysSinceDonation !== null ? `${daysSinceDonation}d ago` : 'Never donated'}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                        eligible
                                                            ? 'bg-green-500/10 text-green-500'
                                                            : 'bg-yellow-500/10 text-yellow-500'
                                                    }`}>
                                                        {eligible ? '✓ Eligible' : '⏳ Cooldown'}
                                                    </span>
                                                </div>
                                            </GlassCard>
                                        </motion.div>
                                    </ScrollReveal>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 mt-10">
                                <GlowButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                >
                                    ← Prev
                                </GlowButton>
                                <span className="text-sm text-slate-500 dark:text-gray-400">
                                    Page {page} of {totalPages}
                                </span>
                                <GlowButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                >
                                    Next →
                                </GlowButton>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20">
                        <span className="text-6xl block mb-4">🩸</span>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Donors Found</h3>
                        <p className="text-slate-500 dark:text-gray-400">
                            {search || bloodTypeFilter ? 'Try adjusting your search or filter.' : 'No donors have registered yet.'}
                        </p>
                    </div>
                )}

                {/* Donor Detail Modal */}
                <AnimatePresence>
                    {selectedDonor && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                            onClick={() => setSelectedDonor(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                onClick={e => e.stopPropagation()}
                                className="w-full max-w-lg"
                            >
                                <GlassCard className="p-6" hover={false}>
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Donor Details</h2>
                                        <button
                                            onClick={() => setSelectedDonor(null)}
                                            className="w-8 h-8 rounded-full bg-slate-200/50 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl shrink-0">
                                            {selectedDonor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedDonor.name}</h3>
                                            <p className="text-sm text-slate-500 dark:text-gray-400">{selectedDonor.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getBloodTypeColor(selectedDonor.bloodType)}`}>
                                                    {selectedDonor.bloodType}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTier(selectedDonor.xp).bg} ${getTier(selectedDonor.xp).color}`}>
                                                    {getTier(selectedDonor.xp).label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {loadingDonorDetails && (
                                        <div className="mb-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-500 text-sm px-3 py-2">
                                            Refreshing donor details...
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        {[
                                            { label: 'Phone', value: selectedDonor.phone, icon: '📱' },
                                            { label: 'NIC', value: selectedDonor.nicNumber || 'Not set', icon: '🪪' },
                                            { label: 'Weight', value: `${selectedDonor.weight} kg`, icon: '⚖️' },
                                            { label: 'Donations', value: String(selectedDonor.totalDonations), icon: '🩸' },
                                            { label: 'XP', value: String(selectedDonor.xp), icon: '⭐' },
                                            {
                                                label: 'Last Donation',
                                                value: selectedDonor.lastDonationDate
                                                    ? new Date(selectedDonor.lastDonationDate).toLocaleDateString()
                                                    : 'Never',
                                                icon: '📅',
                                            },
                                            {
                                                label: 'Joined',
                                                value: new Date(selectedDonor.createdAt).toLocaleDateString(),
                                                icon: '🗓️',
                                            },
                                        ].map(item => (
                                            <div key={item.label} className="flex items-center gap-2 p-3 rounded-xl bg-slate-100/50 dark:bg-white/5">
                                                <span className="text-lg">{item.icon}</span>
                                                <div>
                                                    <p className="text-[10px] uppercase text-slate-400 dark:text-gray-500">{item.label}</p>
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-[10px] uppercase text-slate-400 dark:text-gray-500 mb-1">Address</p>
                                        <p className="text-sm text-slate-700 dark:text-gray-300">{selectedDonor.address}</p>
                                    </div>

                                    {actionError && (
                                        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-3 py-2">
                                            {actionError}
                                        </div>
                                    )}

                                    {actionSuccess && (
                                        <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm px-3 py-2">
                                            {actionSuccess}
                                        </div>
                                    )}

                                    {canManage && (
                                        <div className="mb-5 p-4 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                                            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">Management Actions</p>
                                                <button
                                                    type="button"
                                                    onClick={() => openEditForm(selectedDonor)}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
                                                >
                                                    Edit Donor
                                                </button>
                                            </div>

                                            <div className="flex flex-col md:flex-row gap-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={1000}
                                                    value={awardPoints}
                                                    onChange={(e) => setAwardPoints(Math.max(1, Number(e.target.value) || 1))}
                                                    className="w-full md:w-32 px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleAwardDonorPoints(false)}
                                                    disabled={awardingPoints}
                                                    className="px-3 py-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-60"
                                                >
                                                    {awardingPoints ? 'Saving...' : 'Award XP'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAwardDonorPoints(true)}
                                                    disabled={awardingPoints}
                                                    className="px-3 py-2 rounded-lg bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-60"
                                                >
                                                    {awardingPoints ? 'Saving...' : 'Record Donation + XP'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <GlowButton
                                            variant="primary"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => setSelectedDonor(null)}
                                        >
                                            Close
                                        </GlowButton>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {editingDonor && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                            onClick={() => setEditingDonor(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.94, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.94, opacity: 0 }}
                                transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-xl"
                            >
                                <GlassCard className="p-6" hover={false}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Donor</h2>
                                        <button
                                            onClick={() => setEditingDonor(null)}
                                            className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Name</span>
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Phone</span>
                                            <input
                                                type="text"
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1 md:col-span-2">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Address</span>
                                            <input
                                                type="text"
                                                value={editForm.address}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Weight (kg)</span>
                                            <input
                                                type="number"
                                                min={30}
                                                max={300}
                                                value={editForm.weight}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, weight: Number(e.target.value) || 30 }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">NIC Number</span>
                                            <input
                                                type="text"
                                                value={editForm.nicNumber}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, nicNumber: e.target.value.toUpperCase() }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Blood Type</span>
                                            <select
                                                value={editForm.bloodType}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, bloodType: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            >
                                                {BLOOD_TYPES.map(bt => (
                                                    <option key={bt} value={bt}>{bt}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Gender</span>
                                            <select
                                                value={editForm.gender}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, gender: e.target.value as '' | 'male' | 'female' }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            >
                                                <option value="">Not set</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                            </select>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Date of Birth</span>
                                            <input
                                                type="date"
                                                value={editForm.dateOfBirth}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1 md:col-span-2">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">District</span>
                                            <input
                                                type="text"
                                                value={editForm.district}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, district: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <GlowButton
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEditingDonor(null)}
                                        >
                                            Cancel
                                        </GlowButton>
                                        <GlowButton
                                            variant="primary"
                                            size="sm"
                                            onClick={handleSaveEdit}
                                            disabled={savingEdit}
                                        >
                                            {savingEdit ? 'Saving...' : 'Save Changes'}
                                        </GlowButton>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showRegisterModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowRegisterModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.94, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.94, opacity: 0 }}
                                transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-2xl"
                            >
                                <GlassCard className="p-6" hover={false}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Register New Donor</h2>
                                        <button
                                            onClick={() => setShowRegisterModal(false)}
                                            className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                                        Upload NIC image for auto-fill, or enter details manually for walk-in donors.
                                    </p>

                                    <div className="mb-4 p-4 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                                        <label className="text-xs text-slate-500 dark:text-gray-400 uppercase block mb-2">NIC Image Upload (Optional)</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleNicImageUpload(e.target.files?.[0] || null)}
                                            className="w-full text-sm text-slate-700 dark:text-gray-300"
                                        />
                                        {nicOcrLoading && <p className="text-xs text-blue-500 mt-2">Extracting NIC details...</p>}
                                    </div>

                                    {registrationError && (
                                        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-3 py-2">
                                            {registrationError}
                                        </div>
                                    )}

                                    {registrationInfo && (
                                        <div className="mb-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-500 text-sm px-3 py-2">
                                            {registrationInfo}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Full Name</span>
                                            <input
                                                type="text"
                                                value={registrationForm.name}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">NIC Number</span>
                                            <input
                                                type="text"
                                                value={registrationForm.nicNumber}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, nicNumber: e.target.value.toUpperCase() }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Blood Type</span>
                                            <select
                                                value={registrationForm.bloodType}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, bloodType: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            >
                                                {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                                            </select>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Phone</span>
                                            <input
                                                type="text"
                                                value={registrationForm.phone}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, phone: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1 md:col-span-2">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Address</span>
                                            <input
                                                type="text"
                                                value={registrationForm.address}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, address: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Weight (kg)</span>
                                            <input
                                                type="number"
                                                min={30}
                                                max={300}
                                                value={registrationForm.weight}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, weight: Number(e.target.value) || 30 }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">District</span>
                                            <input
                                                type="text"
                                                value={registrationForm.district}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, district: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Gender</span>
                                            <select
                                                value={registrationForm.gender}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, gender: e.target.value as '' | 'male' | 'female' }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            >
                                                <option value="">Not set</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                            </select>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Date of Birth</span>
                                            <input
                                                type="date"
                                                value={registrationForm.dateOfBirth}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                        <label className="space-y-1 md:col-span-2">
                                            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">Email (Optional for walk-ins)</span>
                                            <input
                                                type="email"
                                                value={registrationForm.email}
                                                onChange={(e) => setRegistrationForm(prev => ({ ...prev, email: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                            />
                                        </label>
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <GlowButton
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowRegisterModal(false)}
                                        >
                                            Cancel
                                        </GlowButton>
                                        <GlowButton
                                            variant="primary"
                                            size="sm"
                                            onClick={handleRegisterDonor}
                                            disabled={registering || nicOcrLoading}
                                        >
                                            {registering ? 'Registering...' : 'Register Donor'}
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
