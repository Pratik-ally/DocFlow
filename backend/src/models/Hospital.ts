import mongoose, { Document, Schema } from 'mongoose';

export interface IHospital extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  ownerId?: mongoose.Types.ObjectId;
  location?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  phone: string;
  email: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  departments: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSchema = new Schema<IHospital>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    location: {
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true, default: '' },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'SUSPENDED'], default: 'ACTIVE', required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    website: { type: String },
    logoUrl: { type: String },
    description: { type: String },
    departments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

HospitalSchema.index({ name: 1, 'location.city': 1 });

export const Hospital = mongoose.model<IHospital>('Hospital', HospitalSchema);
