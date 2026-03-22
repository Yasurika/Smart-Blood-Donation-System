import { NextRequest } from 'next/server';
import { apiSuccess, apiError, requireAuth, rateLimit } from '@/lib/api-utils';

const OCR_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
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

interface ParsedNicDetails {
    nicNumber?: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female';
    name?: string;
    bloodType?: string;
    address?: string;
}

function normalizeText(text: string) {
    return text.replace(/\r/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

function isValidNicDayCode(dayCode: number) {
    if (dayCode >= 1 && dayCode <= 366) return true;
    if (dayCode >= 501 && dayCode <= 866) return true;
    return false;
}

function findNicNumber(text: string) {
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

function parseNicDetails(nicNumber?: string): ParsedNicDetails {
    if (!nicNumber) return {};

    const nic = nicNumber.toUpperCase();

    if (/^\d{12}$/.test(nic)) {
        const year = Number(nic.slice(0, 4));
        let dayCode = Number(nic.slice(4, 7));
        const gender: 'male' | 'female' = dayCode > 500 ? 'female' : 'male';
        if (dayCode > 500) dayCode -= 500;

        const dateOfBirth = toIsoDate(year, dayCode);
        return { nicNumber: nic, dateOfBirth, gender };
    }

    if (/^\d{9}[VX]$/.test(nic)) {
        const yearPrefix = Number(nic.slice(0, 2));
        const year = yearPrefix > 30 ? 1900 + yearPrefix : 2000 + yearPrefix;

        let dayCode = Number(nic.slice(2, 5));
        const gender: 'male' | 'female' = dayCode > 500 ? 'female' : 'male';
        if (dayCode > 500) dayCode -= 500;

        const dateOfBirth = toIsoDate(year, dayCode);
        return { nicNumber: nic, dateOfBirth, gender };
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

function parseFromLines(text: string): ParsedNicDetails {
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
    if (dobMatch) {
        dateOfBirth = parseDateString(dobMatch[0]);
    }

    let bloodType: string | undefined;
    const bloodGroupMatch = upperText.match(/BLOOD\s*GROUP\s*[:\-]?\s*(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)/i);
    if (bloodGroupMatch) {
        bloodType = bloodGroupMatch[1].toUpperCase();
    }

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

export async function POST(request: NextRequest) {
    const rateLimited = rateLimit(request, { windowMs: 60_000, max: 20, keyPrefix: 'donors-ocr-nic' });
    if (rateLimited) return rateLimited;

    try {
        const authResult = await requireAuth(['hospital', 'admin']);
        if ('error' in authResult) return authResult.error;

        const formData = await request.formData();
        const image = formData.get('image');

        if (!(image instanceof File)) {
            return apiError('NIC image is required', 400);
        }

        if (!image.type.startsWith('image/')) {
            return apiError('Invalid file type. Please upload an image.', 400);
        }

        if (image.size > 10 * 1024 * 1024) {
            return apiError('Image is too large. Please upload a file under 10MB.', 400);
        }

        const arrayBuffer = await image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const tesseract = await import('tesseract.js');

        const worker = await withTimeout(
            tesseract.createWorker('eng'),
            OCR_TIMEOUT_MS,
            'OCR initialization timed out. Please try a clearer image.'
        );
        try {
            const result = await withTimeout(
                worker.recognize(buffer),
                OCR_TIMEOUT_MS,
                'OCR took too long. Please upload a smaller/clearer image.'
            );
            const rawText = normalizeText(result.data.text || '');
            const nicNumber = findNicNumber(rawText);
            const parsed = parseNicDetails(nicNumber);
            const lineParsed = parseFromLines(rawText);

            return apiSuccess({
                ...parsed,
                ...lineParsed,
                ocrText: rawText.replace(/\n/g, ' '),
                confidence: result.data.confidence,
            }, 200);
        } finally {
            await worker.terminate();
        }
    } catch (error) {
        return apiError((error as Error).message || 'Failed to process NIC image', 500);
    }
}
