'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import ScrollReveal from '@/components/animations/ScrollReveal';

// ─── Question Definitions ───────────────────────────────────────────────────
interface Question {
    id: string;
    label: string;
    description?: string;
    type: 'number' | 'select' | 'boolean' | 'date' | 'multi-select' | 'range';
    placeholder?: string;
    unit?: string;
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    icon: string;
    category: string;
    dependency?: { id: string; value: string | boolean };
    required?: boolean;
}

const questions: Question[] = [
    // ── Personal Info ──
    {
        id: 'age', label: 'How old are you?', description: 'Blood donors must be between 18 and 65 years old.',
        type: 'number', placeholder: 'Enter your age', unit: 'years', icon: '🎂', category: 'Personal', min: 1, max: 150, required: true,
    },
    {
        id: 'weight', label: 'What is your body weight?', description: 'Minimum 50kg required for safe blood donation.',
        type: 'number', placeholder: 'Enter weight', unit: 'kg', icon: '⚖️', category: 'Personal', min: 20, max: 300, required: true,
    },
    {
        id: 'gender', label: 'What is your biological sex?', description: 'This affects hemoglobin thresholds and donation intervals.',
        type: 'select', options: ['male', 'female'], icon: '👤', category: 'Personal', required: true,
    },
    // ── Vitals ──
    {
        id: 'hemoglobin', label: 'Do you know your hemoglobin level?', description: 'If you had a recent blood test, enter the value. Leave empty to skip.',
        type: 'number', placeholder: 'e.g. 14.5', unit: 'g/dL', icon: '🩸', category: 'Vitals', min: 0, max: 25, step: 0.1,
    },
    {
        id: 'bloodPressureSystolic', label: 'What is your systolic blood pressure? (top number)', description: 'Normal range: 90-120 mmHg. Skip if unknown.',
        type: 'number', placeholder: 'e.g. 120', unit: 'mmHg', icon: '💓', category: 'Vitals', min: 50, max: 300,
    },
    {
        id: 'bloodPressureDiastolic', label: 'What is your diastolic blood pressure? (bottom number)', description: 'Normal range: 60-80 mmHg. Skip if unknown.',
        type: 'number', placeholder: 'e.g. 80', unit: 'mmHg', icon: '💓', category: 'Vitals', min: 30, max: 200,
    },
    // ── Donation History ──
    {
        id: 'lastDonationDate', label: 'When was your last blood donation?', description: 'Male: 56-day gap required. Female: 84-day gap. Select "Never" if first time.',
        type: 'date', icon: '📅', category: 'History',
    },
    // ── Medical Questions ──
    {
        id: 'diseases', label: 'Do you have any of these conditions?', description: 'Select all that apply. This helps us ensure your safety.',
        type: 'multi-select', options: ['None', 'Diabetes', 'Asthma', 'Hypertension', 'Thyroid', 'Heart Disease', 'Cancer', 'HIV', 'Hepatitis B', 'Hepatitis C', 'Hemophilia', 'Sickle Cell'],
        icon: '🏥', category: 'Medical', required: true,
    },
    {
        id: 'medications', label: 'Are you currently taking any medications?', description: 'Select all that apply.',
        type: 'multi-select', options: ['None', 'Antibiotics', 'Warfarin', 'Heparin', 'Rivaroxaban', 'Apixaban', 'Cyclosporine', 'Tacrolimus', 'Methotrexate', 'Other'],
        icon: '💊', category: 'Medical', required: true,
    },
    {
        id: 'recentSurgery', label: 'Have you had any surgery in the last 6 months?', description: 'Includes major and minor surgical procedures.',
        type: 'boolean', icon: '🔪', category: 'Medical',
    },
    {
        id: 'tattooLast12Months', label: 'Got a tattoo or piercing in the last 12 months?', description: 'This includes body piercings, permanent makeup, and acupuncture.',
        type: 'boolean', icon: '🎨', category: 'Lifestyle',
    },
    {
        id: 'isPregnant', label: 'Are you currently pregnant or breastfeeding?', description: 'Pregnancy and breastfeeding require deferral from donation.',
        type: 'boolean', icon: '🤰', category: 'Medical', dependency: { id: 'gender', value: 'female' },
    },
    {
        id: 'recentTravel', label: 'Have you traveled internationally in the last 6 months?', description: 'Some regions have endemic diseases that require deferral.',
        type: 'boolean', icon: '✈️', category: 'Lifestyle',
    },
];

// ─── Category colors ────────────────────────────────────────────────────────
const categoryColors: Record<string, string> = {
    Personal: 'text-blue-500',
    Vitals: 'text-red-500',
    History: 'text-amber-500',
    Medical: 'text-emerald-500',
    Lifestyle: 'text-purple-500',
};

// ─── Result Interface ────────────────────────────────────────────────────────
interface ResultData {
    isEligible: boolean;
    score: number;
    status: 'ELIGIBLE' | 'PERMANENTLY_REJECTED' | 'TEMPORARILY_DEFERRED';
    result: string;
    message: string;
    reasons: string[];
    recommendations: string[];
    riskFactors: { factor: string; severity: 'low' | 'medium' | 'high' | 'critical'; impact: number }[];
    nextEligibleDate?: string;
}

// ─── Helper: format answer for display ───────────────────────────────────────
function formatAnswer(q: Question, value: unknown): string {
    if (value === undefined || value === null || value === '') return 'Skipped';
    if (q.type === 'boolean') return value ? 'Yes' : 'No';
    if (q.type === 'multi-select') {
        const arr = value as string[];
        return arr.length === 0 ? 'None' : arr.join(', ');
    }
    if (q.type === 'date') {
        if (value === 'never') return 'Never donated';
        return new Date(value as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (q.unit) return `${value} ${q.unit}`;
    if (q.type === 'select') return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    return String(value);
}

// ─── Severity badge colors ───────────────────────────────────────────────────
const severityConfig: Record<string, { bg: string; text: string; label: string }> = {
    low: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Low' },
    medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Medium' },
    high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'High' },
    critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Critical' },
};

export default function EligibilityPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const [result, setResult] = useState<ResultData | null>(null);
    const [loading, setLoading] = useState(false);
    const [started, setStarted] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [neverDonated, setNeverDonated] = useState(false);

    // Determine visible questions (skip dependency-gated ones)
    const visibleQuestions = useMemo(() => {
        return questions.filter(q => {
            if (!q.dependency) return true;
            return answers[q.dependency.id] === q.dependency.value;
        });
    }, [answers]);

    const currentQuestion = visibleQuestions[currentStep];
    const progress = visibleQuestions.length > 0 ? ((currentStep + 1) / visibleQuestions.length) * 100 : 0;
    const isLastQuestion = currentStep >= visibleQuestions.length - 1;

    // ─── Handle answer ──────────────────────────────────────────────────
    const handleAnswer = useCallback((value: unknown) => {
        const question = visibleQuestions[currentStep];
        setAnswers(prev => ({ ...prev, [question.id]: value }));

        if (isLastQuestion) {
            // Go to review
            setTimeout(() => setShowReview(true), 300);
        } else {
            setTimeout(() => setCurrentStep(prev => prev + 1), 300);
        }
    }, [currentStep, visibleQuestions, isLastQuestion]);

    // ─── Handle skip (for optional fields) ──────────────────────────────
    const handleSkip = useCallback(() => {
        if (isLastQuestion) {
            setTimeout(() => setShowReview(true), 300);
        } else {
            setTimeout(() => setCurrentStep(prev => prev + 1), 300);
        }
    }, [isLastQuestion]);

    // ─── Submit to API ──────────────────────────────────────────────────
    const handleSubmit = async () => {
        setShowReview(false);
        setLoading(true);

        const steps = [
            'Analyzing Medical History...',
            'Calculating BMI & Safety Metrics...',
            'Evaluating Blood Pressure & Hemoglobin...',
            'Checking Medication Interactions...',
            'Running 12-Phase Expert System...',
            'Generating Eligibility Report...',
        ];

        for (const step of steps) {
            setLoadingText(step);
            await new Promise(r => setTimeout(r, 700));
        }

        try {
            const diseases = (answers.diseases as string[] || []).filter(d => d !== 'None').map(d => d.toLowerCase().replace(/ /g, '_'));
            const medications = (answers.medications as string[] || []).filter(m => m !== 'None').map(m => m.toLowerCase());

            const apiBody = {
                age: Number(answers.age),
                weight: Number(answers.weight),
                gender: answers.gender as string,
                hemoglobin: answers.hemoglobin ? Number(answers.hemoglobin) : undefined,
                bloodPressureSystolic: answers.bloodPressureSystolic ? Number(answers.bloodPressureSystolic) : undefined,
                bloodPressureDiastolic: answers.bloodPressureDiastolic ? Number(answers.bloodPressureDiastolic) : undefined,
                lastDonationDate: neverDonated ? null : (answers.lastDonationDate || null),
                diseases,
                medications,
                recentSurgery: !!answers.recentSurgery,
                pregnancy: !!answers.isPregnant,
                tattooLast12Months: !!answers.tattooLast12Months,
                recentTravel: !!answers.recentTravel,
            };

            const res = await fetch('/api/eligibility/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiBody),
            });
            const data = await res.json();
            setResult(data.data || data);
        } catch {
            setResult({
                isEligible: false,
                score: 0,
                status: 'TEMPORARILY_DEFERRED',
                result: 'Error',
                message: 'Analysis failed due to a server error.',
                reasons: ['Could not connect to the eligibility engine.'],
                recommendations: ['Please try again later or contact support.'],
                riskFactors: [],
            });
        } finally {
            setLoading(false);
        }
    };

    // ─── Reset everything ───────────────────────────────────────────────
    const resetAll = () => {
        setResult(null);
        setStarted(false);
        setShowReview(false);
        setCurrentStep(0);
        setAnswers({});
        setNeverDonated(false);
    };

    // ─── Group answers by category for review ───────────────────────────
    const reviewGroups = useMemo(() => {
        const groups: Record<string, { question: Question; answer: unknown }[]> = {};
        for (const q of visibleQuestions) {
            if (!groups[q.category]) groups[q.category] = [];
            groups[q.category].push({ question: q, answer: answers[q.id] });
        }
        return groups;
    }, [visibleQuestions, answers]);

    return (
        <div className="min-h-screen pt-28 px-6 pb-20">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <ScrollReveal direction="up" className="text-center mb-12">
                    <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">12-Phase Expert System</span>
                    <h1 className="mt-4 text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                        Smart <span className="text-red-500">Eligibility</span> Check
                    </h1>
                    <p className="mt-4 text-slate-500 dark:text-gray-400 max-w-lg mx-auto">
                        Comprehensive health analysis covering vitals, medical history, medications, and lifestyle factors.
                    </p>
                </ScrollReveal>

                {/* ═══════ START SCREEN ═══════ */}
                {!started ? (
                    <ScrollReveal direction="up" delay={0.2}>
                        <GlassCard className="p-12 text-center">
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                                <span className="text-5xl">🧬</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Donor Health Analysis</h2>
                            <p className="text-slate-500 dark:text-gray-400 mb-4">
                                Answer {questions.length} questions to determine your donation eligibility.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 mb-8">
                                {['Personal', 'Vitals', 'History', 'Medical', 'Lifestyle'].map(cat => (
                                    <span key={cat} className={`text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-white/10 ${categoryColors[cat]}`}>
                                        {cat}
                                    </span>
                                ))}
                            </div>
                            <GlowButton size="lg" onClick={() => setStarted(true)}>
                                Start Health Scan
                            </GlowButton>
                        </GlassCard>
                    </ScrollReveal>

                /* ═══════ LOADING SCREEN ═══════ */
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative w-24 h-24 mb-8">
                            <div className="absolute inset-0 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                            <div className="absolute inset-2 border-4 border-blue-500/20 border-b-blue-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl">🔬</span>
                            </div>
                        </div>
                        <motion.p
                            key={loadingText}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xl font-medium text-slate-700 dark:text-gray-300"
                        >
                            {loadingText}
                        </motion.p>
                        <div className="mt-4 flex gap-1">
                            {[0, 1, 2].map(i => (
                                <motion.div key={i} className="w-2 h-2 rounded-full bg-red-500"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                />
                            ))}
                        </div>
                    </div>

                /* ═══════ RESULT SCREEN ═══════ */
                ) : result ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                        {/* Score Hero */}
                        <GlassCard className={`p-8 mb-6 border-t-8 ${
                            result.status === 'ELIGIBLE' ? 'border-t-green-500' :
                            result.status === 'TEMPORARILY_DEFERRED' ? 'border-t-yellow-500' : 'border-t-red-500'
                        }`}>
                            <div className="text-center mb-8">
                                <div className="text-6xl mb-4">
                                    {result.status === 'ELIGIBLE' ? '🎉' : result.status === 'TEMPORARILY_DEFERRED' ? '⏳' : '⛔'}
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{result.result}</h2>
                                <p className="text-slate-500 dark:text-gray-400">{result.message}</p>

                                {/* Score Ring */}
                                <div className="mt-6 inline-flex flex-col items-center">
                                    <div className="relative w-32 h-32">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-white/10" />
                                            <motion.circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
                                                className={result.score >= 80 ? 'text-green-500' : result.score >= 50 ? 'text-yellow-500' : 'text-red-500'}
                                                stroke="currentColor" strokeDasharray={`${2 * Math.PI * 42}`}
                                                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                                                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - result.score / 100) }}
                                                transition={{ duration: 1.5, ease: 'easeOut' }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <motion.span className="text-3xl font-bold text-slate-900 dark:text-white"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                                                {result.score}
                                            </motion.span>
                                            <span className="text-xs text-slate-500">/ 100</span>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-slate-500">Eligibility Score</p>
                                </div>
                            </div>

                            {result.nextEligibleDate && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                                    <span className="text-2xl">📅</span>
                                    <div>
                                        <p className="font-semibold text-blue-700 dark:text-blue-400">Next Eligible Date</p>
                                        <p className="text-blue-600 dark:text-blue-300">{new Date(result.nextEligibleDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                </div>
                            )}
                        </GlassCard>

                        {/* Risk Factors */}
                        {result.riskFactors && result.riskFactors.length > 0 && (
                            <GlassCard className="p-6 mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <span>⚠️</span> Risk Analysis
                                </h3>
                                <div className="space-y-3">
                                    {result.riskFactors.map((rf, i) => {
                                        const sev = severityConfig[rf.severity];
                                        return (
                                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                                                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded ${sev.bg} ${sev.text}`}>{sev.label}</span>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{rf.factor}</span>
                                                </div>
                                                <span className="text-sm font-mono text-red-500">{rf.impact}</span>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </GlassCard>
                        )}

                        {/* Analysis Details */}
                        {result.reasons && result.reasons.length > 0 && (
                            <GlassCard className="p-6 mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <span>📋</span> Detailed Analysis
                                </h3>
                                <ul className="space-y-2">
                                    {result.reasons.map((r, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-gray-300">
                                            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                result.status === 'ELIGIBLE' ? 'bg-green-500' : 'bg-red-500'
                                            }`} />
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            </GlassCard>
                        )}

                        {/* Recommendations */}
                        {result.recommendations && result.recommendations.length > 0 && (
                            <GlassCard className="p-6 mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <span>💡</span> Recommendations
                                </h3>
                                <ul className="space-y-2">
                                    {result.recommendations.map((r, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-gray-300">
                                            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            </GlassCard>
                        )}

                        {/* Your Answers Summary */}
                        <GlassCard className="p-6 mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span>📝</span> Your Responses
                            </h3>
                            {Object.entries(reviewGroups).map(([cat, items]) => (
                                <div key={cat} className="mb-4 last:mb-0">
                                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${categoryColors[cat]}`}>{cat}</p>
                                    <div className="space-y-1">
                                        {items.map(({ question, answer }) => (
                                            <div key={question.id} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5 last:border-0 text-sm">
                                                <span className="text-slate-500 dark:text-gray-400">{question.label.replace(/\?.*/, '?')}</span>
                                                <span className="font-medium text-slate-800 dark:text-gray-200">{formatAnswer(question, answer)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </GlassCard>

                        {/* Actions */}
                        <div className="flex justify-center gap-4">
                            <GlowButton variant="outline" onClick={resetAll}>
                                Check Again
                            </GlowButton>
                            {result.status === 'ELIGIBLE' && (
                                <GlowButton onClick={() => window.location.href = '/dashboard/appointments'}>
                                    Book Appointment
                                </GlowButton>
                            )}
                        </div>
                    </motion.div>

                /* ═══════ REVIEW SCREEN ═══════ */
                ) : showReview ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <GlassCard className="p-8">
                            <div className="text-center mb-8">
                                <span className="text-4xl mb-3 block">📋</span>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Review Your Answers</h2>
                                <p className="text-slate-500 dark:text-gray-400 mt-2">Please verify everything is correct before submitting.</p>
                            </div>

                            {Object.entries(reviewGroups).map(([cat, items]) => (
                                <div key={cat} className="mb-6 last:mb-0">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`text-sm font-bold uppercase tracking-wider ${categoryColors[cat]}`}>{cat}</span>
                                        <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                                    </div>
                                    <div className="space-y-2">
                                        {items.map(({ question, answer }) => {
                                            const display = formatAnswer(question, answer);
                                            const isWarning = (question.id === 'age' && (Number(answer) < 18 || Number(answer) > 65)) ||
                                                (question.id === 'weight' && Number(answer) < 50) ||
                                                (question.type === 'boolean' && answer === true && question.id !== 'gender') ||
                                                (question.id === 'diseases' && Array.isArray(answer) && answer.length > 0 && !answer.includes('None'));

                                            return (
                                                <div key={question.id} className={`flex items-start justify-between p-3 rounded-lg ${
                                                    isWarning ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-white/5'
                                                }`}>
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-lg">{question.icon}</span>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-800 dark:text-gray-200">{question.label.replace(/\?.*/, '?')}</p>
                                                            <p className={`text-sm mt-0.5 ${isWarning ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-500 dark:text-gray-400'}`}>
                                                                {display}
                                                                {isWarning && ' ⚠️'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const idx = visibleQuestions.findIndex(q => q.id === question.id);
                                                            if (idx >= 0) { setShowReview(false); setCurrentStep(idx); }
                                                        }}
                                                        className="text-xs text-blue-500 hover:text-blue-700 font-medium flex-shrink-0 ml-2"
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div className="mt-8 flex justify-between items-center">
                                <button onClick={() => { setShowReview(false); setCurrentStep(visibleQuestions.length - 1); }}
                                    className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                    ← Back to Questions
                                </button>
                                <GlowButton size="lg" onClick={handleSubmit}>
                                    🔬 Run Analysis
                                </GlowButton>
                            </div>
                        </GlassCard>
                    </motion.div>

                /* ═══════ QUESTIONS SCREEN ═══════ */
                ) : (
                    <div>
                        {/* Progress */}
                        <div className="mb-6 flex justify-between items-center text-sm font-medium text-slate-500 dark:text-gray-400">
                            <span className="flex items-center gap-2">
                                <span className={categoryColors[currentQuestion?.category]}>{currentQuestion?.icon}</span>
                                <span className={categoryColors[currentQuestion?.category]}>{currentQuestion?.category}</span>
                            </span>
                            <span>Question {currentStep + 1} of {visibleQuestions.length}</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full mb-8 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <GlassCard className="p-8">
                                    <div className="flex items-start gap-4 mb-2">
                                        <span className="text-3xl">{currentQuestion?.icon}</span>
                                        <div>
                                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{currentQuestion?.label}</h3>
                                            {currentQuestion?.description && (
                                                <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">{currentQuestion.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-8">
                                        {/* Boolean */}
                                        {currentQuestion?.type === 'boolean' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <button onClick={() => handleAnswer(true)}
                                                    className={`p-5 rounded-xl border-2 transition-all font-medium text-lg ${
                                                        answers[currentQuestion.id] === true
                                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600'
                                                            : 'border-slate-200 dark:border-white/10 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'
                                                    }`}>
                                                    Yes
                                                </button>
                                                <button onClick={() => handleAnswer(false)}
                                                    className={`p-5 rounded-xl border-2 transition-all font-medium text-lg ${
                                                        answers[currentQuestion.id] === false
                                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600'
                                                            : 'border-slate-200 dark:border-white/10 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10'
                                                    }`}>
                                                    No
                                                </button>
                                            </div>
                                        )}

                                        {/* Select */}
                                        {currentQuestion?.type === 'select' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                {currentQuestion.options?.map(opt => (
                                                    <button key={opt} onClick={() => handleAnswer(opt)}
                                                        className={`p-5 rounded-xl border-2 capitalize transition-all font-medium text-lg ${
                                                            answers[currentQuestion.id] === opt
                                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                                                                : 'border-slate-200 dark:border-white/10 hover:border-blue-500'
                                                        }`}>
                                                        {opt === 'male' ? '👨 Male' : '👩 Female'}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Multi-Select */}
                                        {currentQuestion?.type === 'multi-select' && (() => {
                                            const selected = (answers[currentQuestion.id] as string[]) || [];
                                            const toggleOption = (opt: string) => {
                                                let newSelected: string[];
                                                if (opt === 'None') {
                                                    newSelected = ['None'];
                                                } else {
                                                    newSelected = selected.filter(s => s !== 'None');
                                                    if (newSelected.includes(opt)) {
                                                        newSelected = newSelected.filter(s => s !== opt);
                                                    } else {
                                                        newSelected.push(opt);
                                                    }
                                                }
                                                if (newSelected.length === 0) newSelected = ['None'];
                                                setAnswers(prev => ({ ...prev, [currentQuestion.id]: newSelected }));
                                            };
                                            return (
                                                <div>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                        {currentQuestion.options?.map(opt => (
                                                            <button key={opt} onClick={() => toggleOption(opt)}
                                                                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                                                                    selected.includes(opt)
                                                                        ? opt === 'None'
                                                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600'
                                                                            : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600'
                                                                        : 'border-slate-200 dark:border-white/10 hover:border-slate-400'
                                                                }`}>
                                                                {selected.includes(opt) ? '✓ ' : ''}{opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="mt-6 flex justify-end">
                                                        <GlowButton onClick={() => handleAnswer(selected)}>
                                                            Continue →
                                                        </GlowButton>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Date with "Never" option */}
                                        {currentQuestion?.type === 'date' && (
                                            <div className="space-y-4">
                                                <button onClick={() => { setNeverDonated(true); handleAnswer('never'); }}
                                                    className={`w-full p-4 rounded-xl border-2 text-left font-medium transition-all ${
                                                        neverDonated
                                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600'
                                                            : 'border-slate-200 dark:border-white/10 hover:border-green-500'
                                                    }`}>
                                                    🆕 This will be my first donation
                                                </button>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                                                    <span className="text-xs text-slate-400">OR</span>
                                                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                                                </div>
                                                <div className="flex gap-4">
                                                    <input type="date"
                                                        className="flex-1 p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:border-red-500 outline-none transition-all"
                                                        max={new Date().toISOString().split('T')[0]}
                                                        value={neverDonated ? '' : (answers[currentQuestion.id] as string || '')}
                                                        onChange={(e) => { setNeverDonated(false); setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value })); }}
                                                    />
                                                    <GlowButton onClick={() => { if (!neverDonated && answers[currentQuestion.id]) handleAnswer(answers[currentQuestion.id]); }}
                                                        disabled={neverDonated || !answers[currentQuestion.id]}>
                                                        Next
                                                    </GlowButton>
                                                </div>
                                            </div>
                                        )}

                                        {/* Number Input */}
                                        {currentQuestion?.type === 'number' && (
                                            <div className="flex gap-4">
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="number"
                                                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:border-red-500 outline-none transition-all text-lg"
                                                        placeholder={currentQuestion.placeholder}
                                                        value={answers[currentQuestion.id] !== undefined ? String(answers[currentQuestion.id]) : ''}
                                                        min={currentQuestion.min}
                                                        max={currentQuestion.max}
                                                        step={currentQuestion.step || 1}
                                                        onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && answers[currentQuestion.id]) handleAnswer(answers[currentQuestion.id]);
                                                        }}
                                                        autoFocus
                                                    />
                                                    {currentQuestion.unit && (
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                                                            {currentQuestion.unit}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {!currentQuestion.required && (
                                                        <button onClick={handleSkip}
                                                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-400 hover:text-slate-600 transition-colors">
                                                            Skip
                                                        </button>
                                                    )}
                                                    <GlowButton onClick={() => handleAnswer(answers[currentQuestion.id])}
                                                        disabled={currentQuestion.required && !answers[currentQuestion.id]}>
                                                        Next
                                                    </GlowButton>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Navigation */}
                                    <div className="mt-8 flex justify-between items-center">
                                        <button
                                            onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
                                            className={`text-sm text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors ${currentStep === 0 ? 'invisible' : ''}`}
                                        >
                                            ← Previous
                                        </button>
                                        {isLastQuestion && currentQuestion?.type !== 'boolean' && currentQuestion?.type !== 'select' && (
                                            <GlowButton variant="outline" onClick={() => {
                                                if (currentQuestion?.type === 'number' && answers[currentQuestion.id]) {
                                                    handleAnswer(answers[currentQuestion.id]);
                                                } else {
                                                    setShowReview(true);
                                                }
                                            }}>
                                                Review Answers →
                                            </GlowButton>
                                        )}
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </AnimatePresence>

                        {/* Question indicator dots */}
                        <div className="flex justify-center gap-1.5 mt-6">
                            {visibleQuestions.map((_, i) => (
                                <button key={i} onClick={() => setCurrentStep(i)}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                        i === currentStep ? 'bg-red-500 w-6' :
                                        i < currentStep || answers[visibleQuestions[i].id] !== undefined ? 'bg-red-300' : 'bg-slate-300 dark:bg-white/20'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
