import { z } from 'zod';

// ─── Shared Enums ───────────────────────────────────────────────────────────
export const BloodTypeEnum = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
export const UrgencyEnum = z.enum(['Critical', 'High', 'Medium', 'Low']);
export const NicNumberSchema = z.string().trim().toUpperCase().regex(/^(\d{9}[VvXx]|\d{12})$/, 'Invalid NIC number format');

// ─── Auth Schemas ───────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
    email: z.string().email('Invalid email address').max(255).toLowerCase().trim(),
    nicNumber: NicNumberSchema,
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    bloodType: BloodTypeEnum,
    dateOfBirth: z.string().optional().nullable(),
    gender: z.enum(['male', 'female']).optional().nullable(),
    district: z.string().max(100).trim().optional().nullable(),
    weight: z.coerce.number()
        .refine(val => !isNaN(val) && val >= 30, 'Weight must be at least 30kg')
        .refine(val => val <= 300, 'Weight cannot exceed 300kg'),
    address: z.string().min(5, 'Address is too short').max(500).trim(),
    phone: z.string()
        .min(9, 'Phone number too short')
        .max(15)
        .regex(/^[+]?[\d\s-]{9,15}$/, 'Invalid phone number format'),
}).passthrough(); // Allow but ignore extra fields

export const RegisterHospitalSchema = z.object({
    name: z.string().min(2, 'Hospital name must be at least 2 characters').max(200).trim(),
    email: z.string().email('Invalid email address').max(255).toLowerCase().trim(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    address: z.string().min(5, 'Address is too short').max(500).trim(),
    district: z.string().max(100).trim().optional().nullable(),
    phone: z.string().min(9).max(15).regex(/^[+]?[\d\s-]{9,15}$/, 'Invalid phone number format'),
    contactPerson: z.string().min(2, 'Contact person name is required').max(100).trim(),
    facilities: z.array(z.string().max(100)).max(50).default([]),
    latitude: z.coerce.number()
        .refine(val => !isNaN(val) && val >= -90 && val <= 90, 'Invalid latitude')
        .optional()
        .nullable(),
    longitude: z.coerce.number()
        .refine(val => !isNaN(val) && val >= -180 && val <= 180, 'Invalid longitude')
        .optional()
        .nullable(),
}).passthrough(); // Allow but ignore extra fields

export const LoginSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(1, 'Password is required'),
    role: z.enum(['donor', 'hospital', 'admin']).default('donor'),
});

// ─── Donor Schemas ──────────────────────────────────────────────────────────
export const UpdateDonorSchema = z.object({
    name: z.string().min(2).max(100).trim().optional(),
    phone: z.string().min(9).max(20).optional(),
    address: z.string().min(5).max(500).trim().optional(),
    weight: z.coerce.number().min(30).max(300).optional(),
    bloodType: BloodTypeEnum.optional(),
    nicNumber: NicNumberSchema.optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(['male', 'female']).optional(),
    district: z.string().max(100).trim().optional(),
    location: z.object({
        type: z.literal('Point').default('Point'),
        coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
    }).optional(),
}).strict();

export const CreateDonorByHospitalSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    nicNumber: NicNumberSchema,
    bloodType: BloodTypeEnum,
    phone: z.string()
        .min(9, 'Phone number too short')
        .max(15)
        .regex(/^[+]?[\d\s-]{9,15}$/, 'Invalid phone number format'),
    address: z.string().min(5, 'Address is too short').max(500).trim(),
    weight: z.coerce.number().min(30).max(300),
    district: z.string().max(100).trim().optional().nullable(),
    gender: z.enum(['male', 'female']).optional().nullable(),
    dateOfBirth: z.coerce.date().optional().nullable(),
    email: z.string().email().max(255).toLowerCase().trim().optional().nullable(),
    nicImageUrl: z.string().max(500).optional().nullable(),
}).strict();

// ─── Hospital Schemas ───────────────────────────────────────────────────────
export const CreateHospitalSchema = z.object({
    name: z.string().min(2).max(200).trim(),
    email: z.string().email().max(255).toLowerCase().trim(),
    password: z.string().min(8).max(128),
    address: z.string().min(5).max(500).trim(),
    phone: z.string().min(9).max(15),
    contactPerson: z.string().min(2).max(100).trim(),
    facilities: z.array(z.string().max(100)).max(50).default([]),
    location: z.object({
        type: z.literal('Point').default('Point'),
        coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
    }).optional(),
});

export const UpdateHospitalSchema = CreateHospitalSchema.partial().omit({ password: true, email: true });

// ─── Appointment Schemas ────────────────────────────────────────────────────
export const CreateAppointmentSchema = z.object({
    donorId: z.string().min(1).optional(),
    hospitalId: z.string().min(1),
    date: z.coerce.date().refine(d => d > new Date(), { message: 'Appointment date must be in the future' }),
    timeSlot: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),
    notes: z.string().max(500).optional(),
});

export const UpdateAppointmentSchema = z.object({
    status: z.enum(['Scheduled', 'Completed', 'NoShow', 'Cancelled']).optional(),
    notes: z.string().max(500).optional(),
    date: z.coerce.date().optional(),
    timeSlot: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
});

// ─── Blood Request Schemas ──────────────────────────────────────────────────
export const CreateBloodRequestSchema = z.object({
    bloodType: BloodTypeEnum,
    units: z.coerce.number().int().min(1).max(100),
    urgency: UrgencyEnum.default('Medium'),
    notes: z.string().max(1000).optional(),
    expiresAt: z.coerce.date().optional(),
});

export const UpdateBloodRequestSchema = z.object({
    status: z.enum(['Active', 'Fulfilled', 'Cancelled', 'Expired']).optional(),
    units: z.coerce.number().int().min(1).max(100).optional(),
    urgency: UrgencyEnum.optional(),
    notes: z.string().max(1000).optional(),
});

// ─── Blood Stock Schemas ────────────────────────────────────────────────────
export const CreateBloodStockSchema = z.object({
    hospitalId: z.string().min(1),
    bloodType: BloodTypeEnum,
    units: z.coerce.number().int().min(1).max(1000),
    barcode: z.string().min(5).max(50),
    expiryDate: z.coerce.date().refine(d => d > new Date(), { message: 'Expiry date must be in the future' }),
    donorId: z.string().optional(),
});

export const UpdateBloodStockSchema = z.object({
    units: z.coerce.number().int().min(0).max(1000).optional(),
    status: z.enum(['Available', 'Reserved', 'Transfused', 'Expired', 'Discarded']).optional(),
    expiryDate: z.coerce.date().optional(),
});

// ─── Campaign Schemas ───────────────────────────────────────────────────────
export const CreateCampaignSchema = z.object({
    title: z.string().min(3).max(200).trim(),
    description: z.string().min(10).max(2000).trim(),
    organizerId: z.string().min(1),
    location: z.object({
        address: z.string().min(5).max(500),
        coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).default([0, 0]),
    }),
    date: z.coerce.date().refine(d => d > new Date(), { message: 'Campaign date must be in the future' }),
    endDate: z.coerce.date(),
    maxCapacity: z.coerce.number().int().min(1).max(10000).default(100),
    image: z.string().url().optional(),
}).refine(data => data.endDate > data.date, { message: 'End date must be after start date', path: ['endDate'] });

// ─── Notification Schemas ───────────────────────────────────────────────────
export const CreateNotificationSchema = z.object({
    userId: z.string().min(1),
    type: z.enum(['SMS', 'Push', 'Email', 'System']).default('System'),
    title: z.string().min(1).max(200).trim(),
    message: z.string().min(1).max(2000).trim(),
    link: z.string().max(500).optional(),
});

// ─── Badge Schemas ──────────────────────────────────────────────────────────
export const CreateBadgeSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    description: z.string().min(5).max(500).trim(),
    criteria: z.string().min(5).max(500),
    icon: z.string().min(1).max(200),
    xpValue: z.coerce.number().int().min(1).max(10000).default(100),
    tier: z.enum(['Bronze', 'Silver', 'Gold', 'Platinum']).default('Bronze'),
});

// ─── Eligibility Check Schema (with Enhanced Validation) ──────────────────
export const EligibilityCheckSchema = z.object({
    donorId: z.string().optional(),
    age: z.coerce.number()
        .int('Age must be a whole number')
        .min(1, 'Age must be at least 1')
        .max(150, 'Age must be 150 or less')
        .refine(age => age >= 18, {
            message: 'Minimum donation age is 18 years'
        })
        .refine(age => age <= 120, {
            message: 'Invalid age detected'
        }),
    weight: z.coerce.number()
        .min(10, 'Minimum weight is 10kg')
        .max(500, 'Maximum weight is 500kg')
        .refine(w => w >= 50, {
            message: 'Minimum donation weight is 50kg according to WHO standards'
        }),
    gender: z.enum(['male', 'female'], {
        message: 'Gender must be "male" or "female"'
    }),
    hemoglobin: z.coerce.number()
        .min(5, 'Hemoglobin too low')
        .max(20, 'Hemoglobin too high')
        .optional(),
    lastDonationDate: z.string()
        .refine(date => !isNaN(Date.parse(date)), {
            message: 'Invalid date format. Use ISO 8601 (YYYY-MM-DD)'
        })
        .nullable()
        .optional(),
    diseases: z.array(z.string().max(100).trim())
        .max(50, 'Cannot list more than 50 diseases')
        .default([]),
    medications: z.array(z.string().max(100).trim())
        .max(50, 'Cannot list more than 50 medications')
        .default([]),
    recentSurgery: z.boolean().default(false),
    pregnancy: z.boolean().default(false),
    tattooLast12Months: z.boolean().default(false),
    recentTravel: z.boolean().default(false),
    bloodPressureSystolic: z.coerce.number()
        .min(50, 'Systolic BP must be at least 50 mmHg')
        .max(300, 'Systolic BP must be under 300 mmHg')
        .optional(),
    bloodPressureDiastolic: z.coerce.number()
        .min(30, 'Diastolic BP must be at least 30 mmHg')
        .max(200, 'Diastolic BP must be under 200 mmHg')
        .optional(),
}).refine(
    data => {
        if (!data.lastDonationDate) return true;
        return new Date(data.lastDonationDate) <= new Date();
    },
    {
        message: 'Last donation date cannot be in the future',
        path: ['lastDonationDate']
    }
);

// ─── Audit Log Schema ───────────────────────────────────────────────────────
export const CreateAuditLogSchema = z.object({
    userId: z.string().min(1),
    action: z.string().min(1).max(200),
    entity: z.string().min(1).max(100),
    entityId: z.string().optional(),
    details: z.string().min(1).max(2000),
    ipAddress: z.string().max(45).optional(),
});
