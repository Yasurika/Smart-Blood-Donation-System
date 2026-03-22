import mongoose, { Schema, models } from 'mongoose';

const BadgeSchema = new Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    criteria: { type: String, required: true },
    icon: { type: String, required: true },
    xpValue: { type: Number, required: true, default: 100 },
    tier: { type: String, enum: ['Bronze', 'Silver', 'Gold', 'Platinum'], default: 'Bronze' },
}, { timestamps: true });

export default models.Badge || mongoose.model('Badge', BadgeSchema);
