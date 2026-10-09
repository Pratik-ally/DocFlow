import mongoose, { Document, Schema } from 'mongoose';

export interface IHospital extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
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
  description?: string;
  departments: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSchema = new Schema<IHospital>(
  {
    name: { type: String, required: true, trim: true },
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
    description: { type: String },
    departments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Hospital = mongoose.model<IHospital>('Hospital', HospitalSchema);
