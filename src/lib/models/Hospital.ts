import mongoose, { Schema, models } from 'mongoose';

const HospitalSchema = new Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    email: {
        type: String, required: true, unique: true, lowercase: true, trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, default: 'hospital', immutable: true },
    address: { type: String, required: true, trim: true, minlength: 5 },
    district: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, required: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    contactPerson: { type: String, required: true, trim: true, minlength: 2 },
    facilities: [{ type: String, maxlength: 100 }],
    isActive: { type: Boolean, default: true },
    operatingHours: {
        open: { type: String, default: '08:00' },
        close: { type: String, default: '17:00' },
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
}, { timestamps: true });

HospitalSchema.index({ location: '2dsphere' });
HospitalSchema.index({ isActive: 1 });

export default models.Hospital || mongoose.model('Hospital', HospitalSchema);
