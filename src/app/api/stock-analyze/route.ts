/**
 * Blood Stock Analysis Endpoint
 * 
 * Route: POST /api/stock-analyze
 * 
 * This endpoint calls the Python StockAnalyzer to assess current inventory levels,
 * generate critical alerts, and provide actionable recommendations.
 * 
 * Returns: Stock status, alerts, days of supply (DOS), and action items
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { analyzeStock, safePythonCall } from '@/lib/python-integration';
import { rateLimit, requireAuth } from '@/lib/api-utils';
import dbConnect from '@/lib/db';
import BloodStock from '@/lib/models/BloodStock';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface StockAnalysisRequest {
  hospitalId?: string;
  stock?: Record<string, { units: number; expiring_soon?: number; avg_daily_usage?: number }>;
}

interface StockAnalysisSummary {
  bloodType: string;
  units: number;
  safe_level: number;
  status: 'surplus' | 'adequate' | 'low' | 'critical';
  days_of_supply: number;
  expiring_soon: number;
  fill_percentage: number;
}

// ─── Helper: Fetch Current Hospital Stock ─────────────────────────────────────

async function getHospitalStock(hospitalId?: string): Promise<Record<string, any>> {
  try {
    await dbConnect();
    
    // Fetch from BloodStock collection
    // For now, return sample data
    return {
      'O+': { units: 45, expiring_soon: 2, avg_daily_usage: 8 },
      'A+': { units: 32, expiring_soon: 1, avg_daily_usage: 6 },
      'B+': { units: 28, expiring_soon: 0, avg_daily_usage: 5 },
      'AB+': { units: 15, expiring_soon: 1, avg_daily_usage: 2 },
      'O-': { units: 20, expiring_soon: 2, avg_daily_usage: 3 },
      'A-': { units: 12, expiring_soon: 0, avg_daily_usage: 2 },
      'B-': { units: 10, expiring_soon: 1, avg_daily_usage: 1.5 },
      'AB-': { units: 5, expiring_soon: 0, avg_daily_usage: 0.5 },
    };
  } catch (error) {
    logger.warn('Failed to fetch stock data, using defaults', { error });
    return {};
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rateLimited = rateLimit(req, {
    windowMs: 60_000,
    max: 30,
    keyPrefix: 'stock-analyze',
  });
  if (rateLimited) return rateLimited;

  const authResult = await requireAuth(['hospital', 'admin']);
  if ('error' in authResult) return authResult.error;

  try {
    const body = (await req.json()) as StockAnalysisRequest;
    
    // Get stock data
    let stockData = body.stock || (await getHospitalStock(body.hospitalId));
    
    if (!stockData || Object.keys(stockData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No stock data available',
        },
        { status: 400 }
      );
    }

    // Call Python stock analyzer
    const analysisResult = await safePythonCall(cfg =>
      analyzeStock({ stock: stockData }, cfg)
    );

    if (!analysisResult) {
      logger.warn('Python analyzer unavailable, returning cached analysis');
      return NextResponse.json(
        {
          success: false,
          message: 'Stock analysis service temporarily unavailable.',
          data: {
            timestamp: new Date().toISOString(),
            status: 'unknown',
            alerts: [],
            summary: {},
            engine: 'typescript-fallback',
          },
        },
        { status: 503 }
      );
    }

    // Extract alerts and apply severity sorting
    const alertsArray = (analysisResult.alerts as any[] || []);
    const alerts = alertsArray.sort((a: any, b: any) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return (severityOrder[a.severity as keyof typeof severityOrder] ?? 2) - 
             (severityOrder[b.severity as keyof typeof severityOrder] ?? 2);
    });

    // Log critical alerts
    const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      logger.warn('CRITICAL STOCK ALERTS', {
        count: criticalAlerts.length,
        alerts: criticalAlerts.map((a: any) => a.bloodType),
      });
    }

    // Log summary stats
    logger.info('Stock analysis completed', {
      timestamp: new Date().toISOString(),
      totalUnits: analysisResult.total_units,
      overallStatus: analysisResult.overall_status,
      alertCount: alerts.length,
      criticalCount: criticalAlerts.length,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          hospitalId: body.hospitalId,
          summary: analysisResult.summary,
          alerts,
          totalUnits: analysisResult.total_units,
          overallStatus: analysisResult.overall_status,
          engine: 'python',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Stock analysis error', { error: (error as Error).message });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze stock levels',
      },
      { status: 500 }
    );
  }
}

// ─── GET: Fetch Latest Analysis ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const rateLimited = rateLimit(req, {
    windowMs: 60_000,
    max: 30,
    keyPrefix: 'stock-analyze-get',
  });
  if (rateLimited) return rateLimited;

  const authResult = await requireAuth(['hospital', 'admin']);
  if ('error' in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const hospitalId = searchParams.get('hospitalId');

    if (!hospitalId) {
      return NextResponse.json(
        {
          success: false,
          error: 'hospitalId query parameter is required',
        },
        { status: 400 }
      );
    }

    // Fetch and analyze current stock
    const stockData = await getHospitalStock(hospitalId);

    if (!stockData || Object.keys(stockData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No stock data found for hospital',
        },
        { status: 404 }
      );
    }

    const analysisResult = await safePythonCall(cfg =>
      analyzeStock({ stock: stockData }, cfg)
    );

    if (!analysisResult) {
      return NextResponse.json(
        {
          success: false,
          error: 'Analysis service unavailable',
        },
        { status: 503 }
      );
    }

    const alertsArray = (analysisResult.alerts as any[] || []);
    const alerts = alertsArray.sort((a: any, b: any) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return (severityOrder[a.severity as keyof typeof severityOrder] ?? 2) - 
             (severityOrder[b.severity as keyof typeof severityOrder] ?? 2);
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          hospitalId,
          summary: analysisResult.summary,
          alerts,
          totalUnits: analysisResult.total_units,
          overallStatus: analysisResult.overall_status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Stock analysis GET error', { error: (error as Error).message });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve stock analysis',
      },
      { status: 500 }
    );
  }
}
