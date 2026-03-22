import mongoose, { Schema, models } from 'mongoose';

const AppointmentSchema = new Schema({
    donorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true, match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format'] },
    status: { type: String, enum: ['Scheduled', 'Completed', 'NoShow', 'Cancelled'], default: 'Scheduled', index: true },
    notes: { type: String, maxlength: 500 },
    cancelledAt: { type: Date },
    cancelReason: { type: String, maxlength: 300 },
    completedAt: { type: Date },
    bloodCollected: { type: Number, min: 0 },  // units collected
}, { timestamps: true });

// Prevent double-booking: same donor cannot have overlapping appointments
AppointmentSchema.index({ donorId: 1, date: 1, timeSlot: 1, status: 1 });
AppointmentSchema.index({ hospitalId: 1, date: 1 });

export default models.Appointment || mongoose.model('Appointment', AppointmentSchema);
