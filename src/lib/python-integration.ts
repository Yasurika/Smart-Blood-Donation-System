/**
 * Python AI Engine Integration Wrapper
 * 
 * Safely calls the remote Python ML service with retry logic, error handling,
 * and fallback mechanisms. This bridges TypeScript APIs with advanced Python analytics.
 */

import logger from '@/lib/logger';

const PYTHON_ENGINE_URL = process.env.PYTHON_ENGINE_URL || 'http://localhost:5050';
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

// ─── Request Interfaces ──────────────────────────────────────────────────────
interface PythonServiceConfig {
  url?: string;
  timeout?: number;
  maxRetries?: number;
}

interface RiskAssessmentRequest {
  age: number;
  weight: number;
  gender: 'male' | 'female';
  hemoglobin?: number;
  systolic?: number;
  diastolic?: number;
  total_donations?: number;
  days_since_last?: number;
  diseases?: string[];
  medications?: string[];
  recent_surgery?: boolean;
  recent_tattoo?: boolean;
  recent_travel?: boolean;
  pregnancy?: boolean;
}

interface RiskAssessmentResult {
  overall_score: number;
  classification: 'LOW_RISK' | 'MODERATE_RISK' | 'ELEVATED_RISK' | 'HIGH_RISK';
  recommendation: string;
  category_scores: Record<string, number>;
  details: Array<{ category: string; note: string }>;
  weights: Record<string, number>;
}

interface ForecastRequest {
  history?: Record<string, number[]>;
  periods?: number;
}

interface StockAnalysisRequest {
  stock: Record<string, { units: number; expiring_soon?: number; avg_daily_usage?: number }>;
}

// ─── Error Handling ──────────────────────────────────────────────────────────

export class PythonServiceError extends Error {
  public isRemote: boolean;
  constructor(message: string, isRemote: boolean = true) {
    super(message);
    this.name = 'PythonServiceError';
    this.isRemote = isRemote;
  }
}

// ─── Health Check ───────────────────────────────────────────────────────────

export async function checkPythonServiceHealth(config: PythonServiceConfig = {}): Promise<boolean> {
  const url = config.url || PYTHON_ENGINE_URL;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || TIMEOUT_MS);

    const response = await fetch(`${url}/api/health`, {
      method: 'POST',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.status === 200;
  } catch (error) {
    logger.debug('Python service health check failed', {
      error: (error as Error).message,
      url,
    });
    return false;
  }
}

// ─── Generic Fetch with Retry Logic ─────────────────────────────────────────

async function callPythonAPI<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  config: PythonServiceConfig = {}
): Promise<T> {
  const url = config.url || PYTHON_ENGINE_URL;
  const timeout = config.timeout || TIMEOUT_MS;
  const maxRetries = config.maxRetries ?? MAX_RETRIES;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${url}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        const data = await response.json();
        if (data.success) {
          return data.data as T;
        } else {
          throw new PythonServiceError(data.error || 'Unknown error from Python service');
        }
      } else if (response.status >= 500) {
        throw new PythonServiceError(`Python service returned ${response.status}`, true);
      } else {
        const errText = await response.text();
        throw new PythonServiceError(`HTTP ${response.status}: ${errText}`, true);
      }
    } catch (error) {
      lastError = error as Error;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.warn(`Python API timeout on attempt ${attempt + 1}/${maxRetries + 1}`, {
            endpoint,
            timeout,
          });
        } else if (error instanceof TypeError) {
          // Network connection failed
          logger.warn(`Python API connection error on attempt ${attempt + 1}/${maxRetries + 1}`, {
            endpoint,
            error: error.message,
          });
        }
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 500; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // All retries exhausted
  logger.error('Python API call failed after retries', {
    endpoint,
    attempts: maxRetries + 1,
    lastError: lastError?.message,
  });

  throw new PythonServiceError(
    `Failed to reach Python service at ${url}${endpoint} after ${maxRetries + 1} attempts`,
    true
  );
}

// ─── Public API Methods ──────────────────────────────────────────────────────

/**
 * Call Python DonorRiskAssessor for advanced multi-factor risk scoring.
 * Returns detailed breakdown with weighted factors and recommendations.
 */
export async function assessDonorRisk(
  donorData: RiskAssessmentRequest,
  config: PythonServiceConfig = {}
): Promise<RiskAssessmentResult> {
  return callPythonAPI<RiskAssessmentResult>('/api/risk-assess', donorData as unknown as Record<string, unknown>, config);
}

/**
 * Call Python DemandForecaster for blood type demand predictions.
 * Returns 7-day forecast with confidence intervals and trend analysis.
 */
export async function forecastDemand(
  request: ForecastRequest,
  config: PythonServiceConfig = {}
): Promise<Record<string, unknown>> {
  return callPythonAPI<Record<string, unknown>>('/api/forecast', request as unknown as Record<string, unknown>, config);
}

/**
 * Call Python StockAnalyzer for inventory health assessment.
 * Returns alerts, recommendations, and days-of-supply calculations.
 */
export async function analyzeStock(
  request: StockAnalysisRequest,
  config: PythonServiceConfig = {}
): Promise<Record<string, unknown>> {
  return callPythonAPI<Record<string, unknown>>('/api/stock-analyze', request as unknown as Record<string, unknown>, config);
}

// ─── Safe Wrapper (Fallback to Null) ─────────────────────────────────────────

/**
 * Safely call Python service, returning null on any failure.
 * Caller is responsible for implementing fallback logic.
 */
export async function safePythonCall<T>(
  fn: (cfg: PythonServiceConfig) => Promise<T>,
  config: PythonServiceConfig = {}
): Promise<T | null> {
  try {
    return await fn(config);
  } catch (error) {
    logger.debug('Python service call failed, fallback to TypeScript', {
      error: (error as Error).message,
    });
    return null;
  }
}

export type { RiskAssessmentRequest, RiskAssessmentResult, ForecastRequest, StockAnalysisRequest };
