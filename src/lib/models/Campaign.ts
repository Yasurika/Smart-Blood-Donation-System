import mongoose, { Schema, models } from 'mongoose';

const CampaignSchema = new Schema({
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    location: {
        address: { type: String, required: true, minlength: 5 },
        coordinates: { type: [Number], default: [0, 0] }
    },
    date: { type: Date, required: true },
    endDate: { type: Date, required: true },
    rsvpList: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    qrCode: { type: String },
    isActive: { type: Boolean, default: true },
    maxCapacity: { type: Number, default: 100, min: 1, max: 10000 },
    image: { type: String },
    totalCollected: { type: Number, default: 0, min: 0 },
    bloodTypesNeeded: [{ type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }],
    tags: [{ type: String, maxlength: 50 }],
}, { timestamps: true });

CampaignSchema.index({ date: 1, isActive: 1 });

export default models.Campaign || mongoose.model('Campaign', CampaignSchema);
