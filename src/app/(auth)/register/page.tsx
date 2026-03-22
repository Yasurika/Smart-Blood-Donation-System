'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';

function normalizeOcrText(text: string) {
    return text.replace(/\r/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

function isValidNicDayCode(dayCode: number) {
    return (dayCode >= 1 && dayCode <= 366) || (dayCode >= 501 && dayCode <= 866);
}

function normalizeNicInput(value?: string) {
    if (!value) return '';
    return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
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

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        nicNumber: '',
        password: '',
        phone: '',
        address: '',
        bloodType: '',
        weight: '',
        dateOfBirth: '',
        gender: '',
        district: '',
        medicalConditions: [] as string[],
        medications: [] as string[],
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showMedical, setShowMedical] = useState(false);
    const [nicOcrLoading, setNicOcrLoading] = useState(false);
    const [nicOcrInfo, setNicOcrInfo] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleNicImageUpload = async (file?: File | null) => {
        if (!file) return;

        setNicOcrLoading(true);
        setNicOcrInfo('');
        setError('');

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

            setFormData(prev => ({
                ...prev,
                nicNumber: extracted.nicNumber || prev.nicNumber,
                dateOfBirth: extracted.dateOfBirth || prev.dateOfBirth,
                gender: extracted.gender || prev.gender,
                name: extracted.name || prev.name,
                bloodType: extracted.bloodType || prev.bloodType,
                address: extracted.address || prev.address,
            }));

            if (hasUsefulData) {
                setNicOcrInfo('NIC details extracted. Please verify fields before submitting.');
            } else {
                setError('Image was read, but no clear NIC details were detected. Please fill manually or upload a clearer image.');
            }
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Failed to extract NIC details');
        } finally {
            setNicOcrLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Validate required fields
            if (!formData.name?.trim()) {
                setError('Full name is required');
                setIsLoading(false);
                return;
            }
            if (!formData.email?.trim()) {
                setError('Email address is required');
                setIsLoading(false);
                return;
            }
            if (!formData.nicNumber?.trim()) {
                setError('NIC number is required');
                setIsLoading(false);
                return;
            }
            if (!formData.password) {
                setError('Password is required');
                setIsLoading(false);
                return;
            }
            if (!formData.bloodType) {
                setError('Blood type is required');
                setIsLoading(false);
                return;
            }
            if (!formData.weight || parseFloat(formData.weight) < 30) {
                setError('Valid weight (minimum 30kg) is required');
                setIsLoading(false);
                return;
            }
            if (!formData.address?.trim()) {
                setError('Address is required');
                setIsLoading(false);
                return;
            }
            if (!formData.phone?.trim()) {
                setError('Phone number is required');
                setIsLoading(false);
                return;
            }

            // Prepare clean data for API
            const submitData = {
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                nicNumber: normalizeNicInput(formData.nicNumber),
                password: formData.password,
                bloodType: formData.bloodType,
                weight: parseFloat(formData.weight),
                address: formData.address.trim(),
                phone: formData.phone.trim(),
                dateOfBirth: formData.dateOfBirth || undefined,
                gender: formData.gender || undefined,
                district: formData.district || undefined,
            };

            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData),
            });

            const data = await res.json();

            if (!res.ok) {
                // Format error messages for display
                if (data.errors && Array.isArray(data.errors)) {
                    const errorMessages = data.errors.map((e: any) => e.message).join(', ');
                    throw new Error(errorMessages);
                }
                throw new Error(data.error || data.message || 'Registration failed');
            }

            // Redirect to login on success
            router.push('/login?registered=true');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 pt-24 pb-12">
            <GlassCard className="w-full max-w-2xl p-8 backdrop-blur-3xl bg-black/40 border-white/10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-white bg-clip-text text-transparent mb-2">
                        Join the Lifesavers
                    </h1>
                    <p className="text-gray-400 text-sm">Create your donor account to start saving lives</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Full Name</label>
                            <input
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white"
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Email Address</label>
                            <input
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white"
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">NIC Number</label>
                            <input
                                name="nicNumber"
                                required
                                value={formData.nicNumber}
                                onChange={(e) => setFormData({ ...formData, nicNumber: e.target.value.toUpperCase() })}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white"
                                placeholder="200120201068 or 012345678V"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-gray-300">NIC Image Upload (Optional)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleNicImageUpload(e.target.files?.[0] || null)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                            />
                            <p className="text-xs text-gray-500">Upload NIC image to auto-fill form details. You can still edit manually.</p>
                            {nicOcrLoading && <p className="text-xs text-blue-400">Extracting NIC details...</p>}
                            {nicOcrInfo && <p className="text-xs text-green-400">{nicOcrInfo}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Phone Number</label>
                            <input
                                name="phone"
                                required
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white"
                                placeholder="+94 7X XXX XXXX"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Blood Type</label>
                            <select
                                name="bloodType"
                                required
                                value={formData.bloodType}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white appearance-none"
                            >
                                <option value="" className="bg-slate-900">Select Type</option>
                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                                    <option key={type} value={type} className="bg-slate-900">{type}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Date of Birth</label>
                            <input
                                name="dateOfBirth"
                                type="date"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Gender</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white appearance-none"
                            >
                                <option value="" className="bg-slate-900">Select Gender</option>
                                <option value="male" className="bg-slate-900">Male</option>
                                <option value="female" className="bg-slate-900">Female</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">District</label>
                            <select
                                name="district"
                                value={formData.district}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white appearance-none"
                            >
                                <option value="" className="bg-slate-900">Select District</option>
                                {['Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Mullaitivu','Batticaloa','Ampara','Trincomalee','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle'].map(d => (
                                    <option key={d} value={d} className="bg-slate-900">{d}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Weight (kg)</label>
                            <input
                                name="weight"
                                type="number"
                                required
                                value={formData.weight}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white"
                                placeholder="65"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Address</label>
                        <input
                            name="address"
                            required
                            value={formData.address}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-white"
                            placeholder="123 Main St, Colombo"
                        />
                    </div>

                    {/* Medical Info (Optional) */}
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => setShowMedical(!showMedical)}
                            className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        >
                            <span className={`transition-transform ${showMedical ? 'rotate-90' : ''}`}>▶</span>
                            Medical Information (Optional)
                        </button>
                        {showMedical && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10"
                            >
                                <p className="text-xs text-gray-400">Select any existing conditions or medications. This helps pre-fill your eligibility checks.</p>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">Pre-existing Conditions</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Diabetes', 'Asthma', 'Hypertension', 'Thyroid', 'Heart Disease', 'Epilepsy'].map(cond => (
                                            <button
                                                key={cond}
                                                type="button"
                                                onClick={() => setFormData(prev => ({
                                                    ...prev,
                                                    medicalConditions: prev.medicalConditions.includes(cond)
                                                        ? prev.medicalConditions.filter(c => c !== cond)
                                                        : [...prev.medicalConditions, cond],
                                                }))}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                    formData.medicalConditions.includes(cond)
                                                        ? 'bg-red-500/20 border-red-500/50 text-red-300'
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                                }`}
                                            >
                                                {cond}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">Current Medications</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Warfarin', 'Insulin', 'Aspirin', 'Blood Pressure Meds', 'Antibiotics'].map(med => (
                                            <button
                                                key={med}
                                                type="button"
                                                onClick={() => setFormData(prev => ({
                                                    ...prev,
                                                    medications: prev.medications.includes(med)
                                                        ? prev.medications.filter(m => m !== med)
                                                        : [...prev.medications, med],
                                                }))}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                    formData.medications.includes(med)
                                                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                                }`}
                                            >
                                                {med}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <GlowButton
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 text-base"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Creating Account...
                            </span>
                        ) : (
                            'Create Account'
                        )}
                    </GlowButton>
                </form>

                <div className="mt-6 text-center space-y-2">
                    <div className="text-sm text-gray-400">
                        Already have an account?{' '}
                        <Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">
                            Sign In here
                        </Link>
                    </div>
                    <div className="text-sm text-gray-400">
                        Registering a hospital?{' '}
                        <Link href="/register/hospital" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            Hospital Registration
                        </Link>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
