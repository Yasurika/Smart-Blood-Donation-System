import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { auth } from '@/auth';
import logger from '@/lib/logger';

// ─── Standardized API Response ──────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    errors?: { field: string; message: string }[];
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
}

export function apiSuccess<T>(data: T, status = 200, meta?: ApiResponse['meta']): NextResponse<ApiResponse<T>> {
    return NextResponse.json({ success: true, data, ...(meta && { meta }) }, { status });
}

export function apiError(error: string, status = 400, errors?: ApiResponse['errors']): NextResponse<ApiResponse> {
    return NextResponse.json({ success: false, error, ...(errors && { errors }) }, { status });
}

// ─── Zod Validation Helper ──────────────────────────────────────────────────
export function validateBody<T>(schema: ZodSchema<T>, data: unknown): { data: T } | { error: NextResponse<ApiResponse> } {
    try {
        const parsed = schema.parse(data);
        return { data: parsed };
    } catch (err) {
        if (err instanceof ZodError) {
            const fieldErrors = err.issues.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            return {
                error: apiError('Validation failed', 422, fieldErrors),
            };
        }
        return { error: apiError('Invalid request body', 400) };
    }
}

// ─── Pagination Helper ─────────────────────────────────────────────────────
export function getPaginationParams(request: NextRequest, defaultLimit = 20, maxLimit = 100) {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit))));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

export function paginationMeta(page: number, limit: number, total: number) {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

// ─── Auth Guard ─────────────────────────────────────────────────────────────
type Role = 'donor' | 'hospital' | 'admin';

export async function requireAuth(allowedRoles?: Role[]) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: apiError('Authentication required', 401) };
    }
    if (allowedRoles && !allowedRoles.includes(session.user.role as Role)) {
        return { error: apiError('Insufficient permissions', 403) };
    }
    return { session };
}

// ─── Rate Limiting (In-Memory, per-route) ───────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
    request: NextRequest,
    { windowMs = 60_000, max = 60, keyPrefix = '' } = {}
): NextResponse<ApiResponse> | null {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        return null;
    }

    entry.count++;
    if (entry.count > max) {
        logger.warn('Rate limit exceeded', { ip, key, count: entry.count });
        return apiError('Too many requests. Please try again later.', 429);
    }

    return null;
}

// ─── Safe Error Handler Wrapper ─────────────────────────────────────────────
type HandlerFn = (request: NextRequest, context?: any) => Promise<NextResponse>;

export function withErrorHandler(handler: HandlerFn): HandlerFn {
    return async (request: NextRequest, context?: any) => {
        try {
            return await handler(request, context);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            logger.error('Unhandled API error', {
                error: message,
                path: request.nextUrl.pathname,
                method: request.method,
                stack: error instanceof Error ? error.stack : undefined,
            });
            return apiError('Internal server error', 500);
        }
    };
}

// ─── Audit Helper ───────────────────────────────────────────────────────────
export async function createAuditEntry(
    userId: string,
    action: string,
    entity: string,
    entityId: string | undefined,
    details: string,
    ipAddress?: string
) {
    try {
        // Dynamic import to avoid circular dependency issues
        const dbConnect = (await import('@/lib/db')).default;
        const AuditLog = (await import('@/lib/models/AuditLog')).default;
        await dbConnect();
        await AuditLog.create({ userId, action, entity, entityId, details, ipAddress, timestamp: new Date() });
    } catch (err) {
        logger.error('Failed to create audit log', { error: err, userId, action });
    }
}

// ─── Client IP Extraction ───────────────────────────────────────────────────
export function getClientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}
