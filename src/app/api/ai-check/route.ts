import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

// This endpoint is deprecated — redirects to the consolidated eligibility engine
// Kept for backward compatibility with any existing frontend calls
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Transform old format to new format for compatibility
        const transformed = {
            donorId: body.donorId,
            age: body.age,
            weight: body.weight,
            gender: body.gender || 'male',
            hemoglobin: body.hemoglobin,
            lastDonationDate: body.lastDonationDate,
            diseases: body.hasChronicDisease ? ['chronic_condition'] : [],
            medications: body.medications || [],
            recentSurgery: body.recentSurgery || false,
            pregnancy: body.isPregnant || false,
            tattooLast12Months: body.hasTattoo || false,
            recentTravel: body.recentTravel || false,
            bloodPressureSystolic: body.bloodPressureSystolic,
            bloodPressureDiastolic: body.bloodPressureDiastolic,
        };

        // Forward to the consolidated eligibility check endpoint
        const baseUrl = request.nextUrl.origin;
        const response = await fetch(`${baseUrl}/api/eligibility/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transformed),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        logger.error('ai-check proxy error', { error: (error as Error).message });
        return NextResponse.json({ success: false, error: 'Failed to process' }, { status: 500 });
    }
}
