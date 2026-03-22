import mongoose, { Schema, models } from 'mongoose';

const BloodRequestSchema = new Schema({
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    units: { type: Number, required: true, min: 1, max: 100 },
    unitsCollected: { type: Number, default: 0, min: 0 },
    urgency: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium', index: true },
    status: { type: String, enum: ['Active', 'Fulfilled', 'Cancelled', 'Expired'], default: 'Active', index: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    respondedDonors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    matchedDonors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    notes: { type: String, maxlength: 1000 },
    expiresAt: { type: Date },
    patientName: { type: String, maxlength: 100 },
}, { timestamps: true });

BloodRequestSchema.index({ location: '2dsphere' });
BloodRequestSchema.index({ bloodType: 1, status: 1 });
BloodRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models.BloodRequest || mongoose.model('BloodRequest', BloodRequestSchema);
