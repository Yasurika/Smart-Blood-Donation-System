import mongoose, { Schema, models } from 'mongoose';

const EligibilityReportSchema = new Schema({
    donorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    answers: { type: Schema.Types.Mixed, required: true },
    result: { type: String, enum: ['Eligible', 'Ineligible', 'Conditional'], required: true },
    status: { type: String, enum: ['ELIGIBLE', 'PERMANENTLY_REJECTED', 'TEMPORARILY_DEFERRED'], required: true },
    reasons: [{ type: String }],
    adminOverride: { type: Boolean, default: false },
    adminNotes: { type: String, maxlength: 1000 },
    nextEligibleDate: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
}, { timestamps: true });

EligibilityReportSchema.index({ donorId: 1, createdAt: -1 });

export default models.EligibilityReport || mongoose.model('EligibilityReport', EligibilityReportSchema);
