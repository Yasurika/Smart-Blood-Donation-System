// SmartBlood TypeScript Interfaces

export interface IUser {
  _id?: string;
  name: string;
  email: string;
  password: string;
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  weight: number;
  address: string;
  phone: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  donationHistory: string[];
  xp: number;
  badges: string[];
  isActive: boolean;
  lastDonationDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IHospital {
  _id?: string;
  name: string;
  email: string;
  address: string;
  phone: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  contactPerson: string;
  facilities: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBloodStock {
  _id?: string;
  hospitalId: string;
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  units: number;
  status: 'Available' | 'Reserved' | 'Transfused' | 'Expired' | 'Discarded';
  barcode: string;
  expiryDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAppointment {
  _id?: string;
  donorId: string;
  hospitalId: string;
  date: Date;
  timeSlot: string;
  status: 'Scheduled' | 'Completed' | 'NoShow' | 'Cancelled';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBloodRequest {
  _id?: string;
  hospitalId: string;
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  units: number;
  urgency: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Fulfilled' | 'Cancelled' | 'Expired';
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  respondedDonors: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICampaign {
  _id?: string;
  title: string;
  description: string;
  organizerId: string;
  location: {
    address: string;
    coordinates: [number, number];
  };
  date: Date;
  endDate: Date;
  rsvpList: string[];
  qrCode?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotification {
  _id?: string;
  userId: string;
  type: 'SMS' | 'Push' | 'Email' | 'System';
  title: string;
  message: string;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEligibilityReport {
  _id?: string;
  donorId: string;
  score: number;
  answers: Record<string, string | number | boolean>;
  result: 'Eligible' | 'Ineligible' | 'Conditional';
  adminOverride?: boolean;
  adminNotes?: string;
  nextEligibleDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBadge {
  _id?: string;
  name: string;
  description: string;
  criteria: string;
  icon: string;
  xpValue: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAuditLog {
  _id?: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details: string;
  ipAddress?: string;
  timestamp: Date;
}
