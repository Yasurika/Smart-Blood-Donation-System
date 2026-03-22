import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import EligibilityReport from "@/lib/models/EligibilityReport";
import logger from "@/lib/logger";
import { EligibilityCheckSchema } from "@/lib/validations";
import { validateBody, rateLimit } from "@/lib/api-utils";

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface EligibilityResult {
    isEligible: boolean;
    status: "ELIGIBLE" | "PERMANENTLY_REJECTED" | "TEMPORARILY_DEFERRED";
    result: "Eligible to Donate" | "Not Eligible" | "Preliminary Eligible - Hospital Verification Required";
    message: string;
    score: number;
    reasons: string[];
    nextEligibleDate?: string;
    recommendations: string[];
    riskFactors: { factor: string; severity: "low" | "medium" | "high" | "critical"; impact: number }[];
}

// ─── Blood Type Compatibility for Donation Context ──────────────────────────
const UNIVERSAL_DONOR_BONUS: Record<string, number> = {
    'O-': 5, // Universal donor — highest demand
    'O+': 3,
    'AB-': 1,
    'AB+': 0,
};

// ─── Expert System: Multi-Factor Eligibility Engine ─────────────────────────
function evaluateDonor(data: {
    age: number;
    weight: number;
    gender: "male" | "female";
    hemoglobin?: number;
    lastDonationDate?: string | null;
    diseases: string[];
    medications: string[];
    recentSurgery: boolean;
    pregnancy: boolean;
    tattooLast12Months: boolean;
    recentTravel: boolean;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
}): EligibilityResult {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    const riskFactors: EligibilityResult["riskFactors"] = [];
    let baseScore = 100;

    // Normalize inputs
    const diseases = (data.diseases || []).map(d => d.toLowerCase().trim());
    const medications = (data.medications || []).map(m => m.toLowerCase().trim());

    // ── PHASE 1: PERMANENT KNOCKOUTS ─────────────────────────────────────
    const permanentDiseases = ["hiv", "hepatitis_b", "hepatitis_c", "cancer", "hemophilia", "sickle_cell"];
    const foundPermanent = diseases.filter(d => permanentDiseases.includes(d));

    if (foundPermanent.length > 0) {
        return {
            isEligible: false,
            status: "PERMANENTLY_REJECTED",
            result: "Not Eligible",
            message: "Permanent deferral due to medical condition",
            score: 0,
            reasons: [`Permanent condition: ${foundPermanent.join(", ")}`],
            recommendations: ["Please consult your healthcare provider for alternative ways to contribute."],
            riskFactors: [{ factor: "Chronic condition", severity: "critical", impact: -100 }],
        };
    }

    // ── PHASE 2: AGE VALIDATION ──────────────────────────────────────────
    if (data.age < 18) {
        return {
            isEligible: false,
            status: "TEMPORARILY_DEFERRED",
            result: "Not Eligible",
            message: "Must be at least 18 years old",
            score: 0,
            reasons: [`Age ${data.age} is below minimum (18).`],
            recommendations: ["You can register when you turn 18."],
            riskFactors: [{ factor: "Underage", severity: "critical", impact: -100 }],
        };
    }

    if (data.age > 65) {
        baseScore -= 30;
        reasons.push(`Age ${data.age} exceeds standard range (18-65). Medical clearance needed.`);
        riskFactors.push({ factor: "Age over 65", severity: "medium", impact: -30 });
        recommendations.push("Get medical clearance from your physician.");
    } else if (data.age > 60) {
        baseScore -= 10;
        riskFactors.push({ factor: "Age 60-65", severity: "low", impact: -10 });
    }

    // ── PHASE 3: WEIGHT & BMI ────────────────────────────────────────────
    if (data.weight < 50) {
        baseScore -= 40;
        reasons.push(`Weight ${data.weight}kg is below minimum 50kg.`);
        riskFactors.push({ factor: "Underweight", severity: "high", impact: -40 });
        recommendations.push("Maintain a healthy diet to reach the required weight.");
    } else if (data.weight < 55) {
        baseScore -= 10;
        riskFactors.push({ factor: "Borderline weight", severity: "low", impact: -10 });
    }

    // ── PHASE 4: HEMOGLOBIN ──────────────────────────────────────────────
    if (data.hemoglobin !== undefined) {
        const minHb = data.gender === "male" ? 13.0 : 12.5;
        if (data.hemoglobin < minHb) {
            baseScore -= 30;
            reasons.push(`Hemoglobin ${data.hemoglobin} g/dL is below minimum ${minHb} g/dL for ${data.gender}s.`);
            riskFactors.push({ factor: "Low hemoglobin", severity: "high", impact: -30 });
            recommendations.push("Include iron-rich foods in your diet (spinach, red meat, lentils).");
        } else if (data.hemoglobin < minHb + 0.5) {
            baseScore -= 5;
            riskFactors.push({ factor: "Borderline hemoglobin", severity: "low", impact: -5 });
        }
    }

    // ── PHASE 5: BLOOD PRESSURE ──────────────────────────────────────────
    if (data.bloodPressureSystolic && data.bloodPressureDiastolic) {
        const sys = data.bloodPressureSystolic;
        const dia = data.bloodPressureDiastolic;

        if (sys > 180 || dia > 100) {
            baseScore -= 40;
            reasons.push(`Blood pressure ${sys}/${dia} mmHg is dangerously high.`);
            riskFactors.push({ factor: "Hypertensive crisis", severity: "critical", impact: -40 });
            recommendations.push("Seek immediate medical attention for your blood pressure.");
        } else if (sys > 140 || dia > 90) {
            baseScore -= 20;
            reasons.push(`Blood pressure ${sys}/${dia} mmHg is elevated.`);
            riskFactors.push({ factor: "High blood pressure", severity: "medium", impact: -20 });
        } else if (sys < 90 || dia < 50) {
            baseScore -= 25;
            reasons.push(`Blood pressure ${sys}/${dia} mmHg is too low.`);
            riskFactors.push({ factor: "Hypotension", severity: "medium", impact: -25 });
        }
    }

    // ── PHASE 6: PREGNANCY ───────────────────────────────────────────────
    if (data.gender === "female" && data.pregnancy) {
        baseScore -= 100;
        reasons.push("Cannot donate during pregnancy.");
        riskFactors.push({ factor: "Pregnancy", severity: "critical", impact: -100 });
        recommendations.push("You can donate 6 months after delivery if not breastfeeding.");
    }

    // ── PHASE 7: LAST DONATION INTERVAL ──────────────────────────────────
    let nextEligibleDate: string | undefined;
    if (data.lastDonationDate) {
        const today = new Date();
        const lastDate = new Date(data.lastDonationDate);
        const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

        // WHO standard: 56 days (8 weeks) minimum, with gender consideration
        const requiredDays = data.gender === "male" ? 56 : 84; // 8 weeks male, 12 weeks female

        if (daysDiff < requiredDays) {
            baseScore -= 50;
            const nextDate = new Date(lastDate);
            nextDate.setDate(nextDate.getDate() + requiredDays);
            nextEligibleDate = nextDate.toISOString().split('T')[0];
            reasons.push(`Only ${daysDiff} days since last donation. Minimum ${requiredDays} days required.`);
            riskFactors.push({ factor: "Recent donation", severity: "high", impact: -50 });
        }
    }

    // ── PHASE 8: TATTOOS & PIERCINGS ─────────────────────────────────────
    if (data.tattooLast12Months) {
        baseScore -= 25;
        reasons.push("Tattoo or piercing within last 12 months requires deferral.");
        riskFactors.push({ factor: "Recent tattoo/piercing", severity: "medium", impact: -25 });
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 12);
        if (!nextEligibleDate || new Date(nextEligibleDate) < nextDate) {
            nextEligibleDate = nextDate.toISOString().split('T')[0];
        }
    }

    // ── PHASE 9: SURGERY ─────────────────────────────────────────────────
    if (data.recentSurgery) {
        baseScore -= 30;
        reasons.push("Recent surgery requires recovery period (6-12 months).");
        riskFactors.push({ factor: "Recent surgery", severity: "high", impact: -30 });
        recommendations.push("Provide medical clearance from your surgeon.");
    }

    // ── PHASE 10: MEDICATIONS ────────────────────────────────────────────
    const anticoagulants = ["warfarin", "heparin", "rivaroxaban", "apixaban"];
    const immunosuppressants = ["cyclosporine", "tacrolimus", "methotrexate"];
    
    const onAnticoagulants = medications.some(m => anticoagulants.includes(m));
    const onImmunosuppressants = medications.some(m => immunosuppressants.includes(m));
    const onAntibiotics = medications.includes("antibiotics");

    if (onAnticoagulants) {
        baseScore -= 40;
        reasons.push("Anticoagulant medication prevents safe donation.");
        riskFactors.push({ factor: "Anticoagulants", severity: "critical", impact: -40 });
    }
    if (onImmunosuppressants) {
        baseScore -= 35;
        reasons.push("Immunosuppressant therapy requires deferral.");
        riskFactors.push({ factor: "Immunosuppressants", severity: "high", impact: -35 });
    }
    if (onAntibiotics) {
        baseScore -= 15;
        reasons.push("Must wait 14 days after completing antibiotics.");
        riskFactors.push({ factor: "Antibiotics", severity: "medium", impact: -15 });
    }

    // Other non-specific medications
    const otherMeds = medications.filter(m => !anticoagulants.includes(m) && !immunosuppressants.includes(m) && m !== "antibiotics");
    if (otherMeds.length > 0) {
        baseScore -= 5 * otherMeds.length;
        reasons.push(`${otherMeds.length} other medication(s) require evaluation.`);
        riskFactors.push({ factor: "Other medications", severity: "low", impact: -(5 * otherMeds.length) });
    }

    // ── PHASE 11: CHRONIC CONDITIONS (non-permanent) ─────────────────────
    const manageable = ["diabetes", "asthma", "thyroid", "hypertension"];
    const foundManageable = diseases.filter(d => manageable.includes(d));
    if (foundManageable.length > 0) {
        baseScore -= 15 * foundManageable.length;
        reasons.push(`Manageable condition(s): ${foundManageable.join(", ")} — medical clearance needed.`);
        riskFactors.push({ factor: "Chronic condition", severity: "medium", impact: -(15 * foundManageable.length) });
        recommendations.push("Get a letter of clearance from your treating physician.");
    }

    // ── PHASE 12: TRAVEL ─────────────────────────────────────────────────
    if (data.recentTravel) {
        baseScore -= 10;
        reasons.push("Recent international travel requires evaluation for endemic diseases.");
        riskFactors.push({ factor: "Recent travel", severity: "low", impact: -10 });
        recommendations.push("Provide travel history details for risk assessment.");
    }

    // ── FINAL SCORING ────────────────────────────────────────────────────
    const finalScore = Math.max(0, Math.min(100, baseScore));

    let status: EligibilityResult["status"];
    let result: EligibilityResult["result"];
    let message: string;

    if (finalScore >= 80) {
        status = "ELIGIBLE";
        result = "Eligible to Donate";
        message = "You are eligible to donate blood!";
        if (reasons.length === 0) reasons.push("All health criteria met.");
    } else if (finalScore >= 50) {
        status = "TEMPORARILY_DEFERRED";
        result = "Preliminary Eligible - Hospital Verification Required";
        message = "You may be eligible with hospital verification and medical clearance.";
    } else {
        status = finalScore === 0 ? "PERMANENTLY_REJECTED" : "TEMPORARILY_DEFERRED";
        result = "Not Eligible";
        message = "You are currently not eligible to donate blood.";
    }

    if (recommendations.length === 0 && result === "Eligible to Donate") {
        recommendations.push("Stay hydrated and eat a balanced meal before donating.");
        recommendations.push("Get at least 7-8 hours of sleep the night before.");
    }

    return {
        isEligible: finalScore >= 80,
        status,
        result,
        message,
        score: finalScore,
        reasons,
        nextEligibleDate,
        recommendations,
        riskFactors,
    };
}

// ─── API Handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const rateLimited = rateLimit(req, { windowMs: 60_000, max: 10, keyPrefix: 'eligibility-check' });
    if (rateLimited) return rateLimited;

    try {
        const body = await req.json();
        const validation = validateBody(EligibilityCheckSchema, body);
        if ('error' in validation) return (validation as { error: NextResponse }).error;

        const result = evaluateDonor(validation.data);

        // Persist the report if donorId provided
        if (validation.data.donorId) {
            try {
                await dbConnect();
                await EligibilityReport.create({
                    donorId: validation.data.donorId,
                    score: result.score,
                    answers: validation.data,
                    result: result.result,
                    status: result.status,
                    reasons: result.reasons,
                    nextEligibleDate: result.nextEligibleDate ? new Date(result.nextEligibleDate) : undefined,
                });
            } catch (dbErr) {
                logger.error('Failed to persist eligibility report', { error: dbErr });
                // Non-blocking: still return result even if DB save fails
            }
        }

        logger.info('Eligibility check completed', { score: result.score, result: result.result, donorId: validation.data.donorId });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        logger.error('Eligibility check error', { error: (error as Error).message });
        return NextResponse.json({ success: false, error: "Failed to process eligibility check" }, { status: 500 });
    }
}
