import mongoose, { Schema, models } from 'mongoose';

const BloodStockSchema = new Schema({
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true, index: true },
    units: { type: Number, required: true, min: 0, max: 1000 },
    status: { type: String, enum: ['Available', 'Reserved', 'Transfused', 'Expired', 'Discarded'], default: 'Available', index: true },
    barcode: { type: String, unique: true, required: true },
    expiryDate: { type: Date, required: true },
    donorId: { type: Schema.Types.ObjectId, ref: 'User' },
    collectedAt: { type: Date, default: Date.now },
    component: { type: String, enum: ['Whole Blood', 'Red Cells', 'Platelets', 'Plasma', 'Cryoprecipitate'], default: 'Whole Blood' },
    temperature: { type: Number },  // Storage temperature at last check
}, { timestamps: true });

BloodStockSchema.index({ hospitalId: 1, bloodType: 1, status: 1 });
BloodStockSchema.index({ expiryDate: 1 });

export default models.BloodStock || mongoose.model('BloodStock', BloodStockSchema);
