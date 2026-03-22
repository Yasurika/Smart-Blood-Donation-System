import mongoose, { Schema, models } from 'mongoose';

const UserSchema = new Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
        type: String, required: true, unique: true, lowercase: true, trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: { type: String, required: true, minlength: 8 },
    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female'] },
    district: { type: String, trim: true, maxlength: 100 },
    weight: { type: Number, required: true, min: 30, max: 300 },
    address: { type: String, required: true, trim: true, minlength: 5 },
    phone: { type: String, required: true, match: [/^[+]?[\d\s-]{9,15}$/, 'Invalid phone format'] },
    nicNumber: {
        type: String,
        trim: true,
        uppercase: true,
        sparse: true,
        unique: true,
        match: [/^(\d{9}[vVxX]|\d{12})$/, 'Invalid NIC format'],
    },
    nicImageUrl: { type: String, maxlength: 500 },
    isWalkInRegistered: { type: Boolean, default: false },
    registeredByHospital: { type: String, maxlength: 50 },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    donationHistory: [{ type: Schema.Types.ObjectId, ref: 'Appointment' }],
    xp: { type: Number, default: 0, min: 0 },
    badges: [{ type: Schema.Types.ObjectId, ref: 'Badge' }],
    isActive: { type: Boolean, default: true },
    lastDonationDate: { type: Date },
    totalDonations: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ['donor', 'admin'], default: 'donor' },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    emergencyContact: {
        name: { type: String, maxlength: 100 },
        phone: { type: String, maxlength: 15 },
        relationship: { type: String, maxlength: 50 },
    },
    medicalInfo: {
        conditions: [{ type: String, maxlength: 100 }],
        medications: [{ type: String, maxlength: 100 }],
        allergies: [{ type: String, maxlength: 100 }],
    },
}, { timestamps: true });

UserSchema.index({ location: '2dsphere' });
UserSchema.index({ bloodType: 1, isActive: 1 });
UserSchema.index({ nicNumber: 1, isActive: 1 });

// Virtual: check if account is locked
UserSchema.virtual('isLocked').get(function () {
    return !!(this.lockedUntil && this.lockedUntil > new Date());
});

const cachedUserModel = models.User;
if (cachedUserModel && !cachedUserModel.schema.path('nicNumber')) {
    delete mongoose.models.User;
}

export default models.User || mongoose.model('User', UserSchema);
