import mongoose, { Schema, models } from 'mongoose';

const NotificationSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['SMS', 'Push', 'Email', 'System', 'Emergency'], default: 'System' },
    title: { type: String, required: true, maxlength: 200, trim: true },
    message: { type: String, required: true, maxlength: 2000, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    link: { type: String, maxlength: 500 },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    expiresAt: { type: Date },
}, { timestamps: true });

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default models.Notification || mongoose.model('Notification', NotificationSchema);
