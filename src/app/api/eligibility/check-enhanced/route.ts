/**
 * Enhanced Eligibility Check with Python ML Engine
 * 
 * Route: POST /api/eligibility/check-enhanced
 * 
 * This endpoint provides advanced risk assessment by:
 * 1. Calling Python DonorRiskAssessor for detailed multi-factor analysis
 * 2. Falling back to TypeScript implementation if Python unavailable
 * 3. Returning both technical risk scores and medical recommendations
 * 4. Persisting results with explainability data
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import EligibilityReport from '@/lib/models/EligibilityReport';
import logger from '@/lib/logger';
import { EligibilityCheckSchema } from '@/lib/validations';
import { validateBody, rateLimit } from '@/lib/api-utils';
import {
  assessDonorRisk,
  safePythonCall,
  PythonServiceError,
  type RiskAssessmentRequest,
  type RiskAssessmentResult,
} from '@/lib/python-integration';

// ─── Enhanced Eligibility Result with Explainability ─────────────────────────

interface EnhancedEligibilityResult {
  isEligible: boolean;
  status: 'ELIGIBLE' | 'PERMANENTLY_REJECTED' | 'TEMPORARILY_DEFERRED';
  result: 'Eligible to Donate' | 'Not Eligible' | 'Preliminary Eligible - Hospital Verification Required';
  message: string;
  score: number;
  reasons: string[];
  nextEligibleDate?: string;
  recommendations: string[];
  riskFactors: { factor: string; severity: 'low' | 'medium' | 'high' | 'critical'; impact: number }[];
  pythonAnalysis?: {
    overall_score: number;
    classification: string;
    recommendation: string;
    category_scores: Record<string, number>;
    details: Array<{ category: string; note: string }>;
  };
  engine: 'python' | 'typescript';
}

// ─── Python Request Mapping ──────────────────────────────────────────────────

function mapToPythonRequest(data: any): RiskAssessmentRequest {
  return {
    age: data.age,
    weight: data.weight,
    gender: data.gender || 'male',
    hemoglobin: data.hemoglobin,
    systolic: data.bloodPressureSystolic,
    diastolic: data.bloodPressureDiastolic,
    total_donations: 0, // Would need to fetch from database
    days_since_last: data.lastDonationDate
      ? Math.floor((Date.now() - new Date(data.lastDonationDate).getTime()) / (1000 * 86400))
      : 500,
    diseases: data.diseases || [],
    medications: data.medications || [],
    recent_surgery: data.recentSurgery || false,
    recent_tattoo: data.tattooLast12Months || false,
    recent_travel: data.recentTravel || false,
    pregnancy: data.pregnancy || false,
  };
}

// ─── Convert Python Result to Eligibility Result ──────────────────────────────

function convertPythonToEligibility(
  pythonResult: RiskAssessmentResult,
  letterData: any
): EnhancedEligibilityResult {
  const score = pythonResult.overall_score;

  let status: EnhancedEligibilityResult['status'];
  let result: EnhancedEligibilityResult['result'];
  let message: string;
  const reasons: string[] = [];
  const recommendations: string[] = [];
  const riskFactors: EnhancedEligibilityResult['riskFactors'] = [];

  // Determine eligibility based on Python classification
  if (pythonResult.classification === 'LOW_RISK') {
    status = 'ELIGIBLE';
    result = 'Eligible to Donate';
    message = 'You are eligible to donate blood! ✓';
    reasons.push('All health criteria met based on advanced ML assessment.');
  } else if (pythonResult.classification === 'MODERATE_RISK') {
    status = 'ELIGIBLE';
    result = 'Eligible to Donate';
    message = 'You are eligible to donate with minor considerations.';
    reasons.push('Some factors require attention, but donation is safe.');
  } else if (pythonResult.classification === 'ELEVATED_RISK') {
    status = 'TEMPORARILY_DEFERRED';
    result = 'Preliminary Eligible - Hospital Verification Required';
    message = 'You may be eligible after medical review.';
    reasons.push('Medical assessment recommended before donation.');
  } else {
    // HIGH_RISK
    status = 'TEMPORARILY_DEFERRED';
    result = 'Not Eligible';
    message = 'Currently not eligible. Please consult your healthcare provider.';
    reasons.push(pythonResult.recommendation);
  }

  // Add category-specific recommendations from Python
  const categoryDetails = pythonResult.details || [];
  categoryDetails.forEach(detail => {
    recommendations.push(`${detail.category.toUpperCase()}: ${detail.note}`);
  });

  // Map category scores to risk factors
  Object.entries(pythonResult.category_scores || {}).forEach(([category, categoryScore]) => {
    const numScore = categoryScore as number;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (numScore < 40) severity = 'critical';
    else if (numScore < 60) severity = 'high';
    else if (numScore < 80) severity = 'medium';

    riskFactors.push({
      factor: category.replace(/_/g, ' '),
      severity,
      impact: Math.round(numScore - 100), // Relative to 100
    });
  });

  if (recommendations.length === 0 && result === 'Eligible to Donate') {
    recommendations.push('Stay hydrated before donation.');
    recommendations.push('Eat a nutritious meal prior to appointment.');
    recommendations.push('Get adequate sleep the night before.');
  }

  return {
    isEligible: status === 'ELIGIBLE',
    status,
    result,
    message,
    score: Math.round(pythonResult.overall_score),
    reasons,
    recommendations,
    riskFactors,
    pythonAnalysis: {
      overall_score: pythonResult.overall_score,
      classification: pythonResult.classification,
      recommendation: pythonResult.recommendation,
      category_scores: pythonResult.category_scores,
      details: pythonResult.details,
    },
    engine: 'python',
  };
}

// ─── TypeScript Fallback ──────────────────────────────────────────────────────

// (Import the original evaluateDonor from route.ts or copy it here)
// For now, we'll create a simple fallback
function evaluateDonorFallback(data: any): EnhancedEligibilityResult {
  const reasons: string[] = [];
  const recommendations: string[] = [];
  const riskFactors: EnhancedEligibilityResult['riskFactors'] = [];
  let baseScore = 100;

  // Basic validations
  if (data.age < 18) {
    baseScore = 0;
    reasons.push('Age must be at least 18 years old.');
  } else if (data.age > 65) {
    baseScore -= 30;
    reasons.push('Age over 65 requires medical clearance.');
  }

  if (data.weight < 50) {
    baseScore -= 40;
    reasons.push('Weight must be at least 50kg.');
  }

  if (data.pregnancy) {
    baseScore = 0;
    reasons.push('Cannot donate during pregnancy.');
  }

  const finalScore = Math.max(0, baseScore);

  return {
    isEligible: finalScore >= 80,
    status: finalScore >= 80 ? 'ELIGIBLE' : 'TEMPORARILY_DEFERRED',
    result: finalScore >= 80 ? 'Eligible to Donate' : 'Not Eligible',
    message:
      finalScore >= 80
        ? 'You are eligible to donate blood!'
        : 'You are currently not eligible to donate.',
    score: finalScore,
    reasons: reasons.length > 0 ? reasons : ['Standard health checks completed.'],
    recommendations: recommendations.length > 0 ? recommendations : ['Consult your healthcare provider.'],
    riskFactors: riskFactors.length > 0 ? riskFactors : [],
    engine: 'typescript',
  };
}

// ─── Main API Handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rateLimited = rateLimit(req, {
    windowMs: 60_000,
    max: 10,
    keyPrefix: 'eligibility-check-enhanced',
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const validation = validateBody(EligibilityCheckSchema, body);
    if ('error' in validation) return (validation as { error: NextResponse }).error;

    const validatedData = validation.data;

    // Try Python engine first
    let result: EnhancedEligibilityResult | null = null;
    let usedPython = false;

    const pythonRequest = mapToPythonRequest(validatedData);
    const pythonResult = await safePythonCall(cfg => assessDonorRisk(pythonRequest, cfg));

    if (pythonResult) {
      result = convertPythonToEligibility(pythonResult, validatedData);
      usedPython = true;
      logger.info('Eligibility assessed using Python engine', {
        donorId: validatedData.donorId,
        score: result.score,
      });
    } else {
      // Fallback to TypeScript
      result = evaluateDonorFallback(validatedData);
      logger.warn('Python engine unavailable, using fallback', {
        donorId: validatedData.donorId,
      });
    }

    // Persist the report if donorId provided
    if (validatedData.donorId) {
      try {
        await dbConnect();
        await EligibilityReport.create({
          donorId: validatedData.donorId,
          score: result.score,
          answers: validatedData,
          result: result.result,
          status: result.status,
          reasons: result.reasons,
          nextEligibleDate: result.nextEligibleDate ? new Date(result.nextEligibleDate) : undefined,
          metadata: {
            engine: result.engine,
            pythonAnalysis: result.pythonAnalysis,
          },
        });
      } catch (dbErr) {
        logger.error('Failed to persist eligibility report', { error: dbErr });
        // Non-blocking: still return result
      }
    }

    logger.info('Eligibility check completed', {
      score: result.score,
      result: result.result,
      engine: result.engine,
      donorId: validatedData.donorId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('Eligibility check error', { error: (error as Error).message });
    return NextResponse.json(
      { success: false, error: 'Failed to process eligibility check' },
      { status: 500 }
    );
  }
}
