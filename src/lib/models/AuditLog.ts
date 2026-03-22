import mongoose, { Schema, models } from 'mongoose';

const AuditLogSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, maxlength: 200 },
    entity: { type: String, required: true, maxlength: 100, index: true },
    entityId: { type: Schema.Types.ObjectId },
    details: { type: String, required: true, maxlength: 2000 },
    ipAddress: { type: String, maxlength: 45 },
    userAgent: { type: String, maxlength: 500 },
    timestamp: { type: Date, default: Date.now, index: true },
});

// Audit logs are immutable — only created and read, never updated or deleted
// TTL index: auto-delete after 2 years to comply with data retention policies
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

export default models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
