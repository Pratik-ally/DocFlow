export type UserRole = 'PATIENT' | 'DOCTOR' | 'STAFF' | 'ADMIN' | 'OWNER';
export type StaffStatus = 'ACTIVE' | 'REMOVED';
export type AppointmentPriority = 'ROUTINE' | 'SOON' | 'HIGH';
export type AppointmentStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  hospitalId?: string;
  status?: StaffStatus;
  mustChangePassword?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  specialization?: string;
  status: StaffStatus;
  lastLoginAt?: string;
  removedAt?: string;
  createdAt: string;
  hospitalId?: string;
  mustChangePassword?: boolean;
}

export interface Doctor {
  _id: string;
  userId: { _id: string; name: string; email: string; phone: string };
  hospitalId: { _id: string; name: string };
  departmentId: { _id: string; name: string };
  specialization: string;
  licenseNumber: string;
  qualifications: string[];
  experience: number;
  consultationFee: number;
  isAvailable: boolean;
}

export interface Department {
  _id: string;
  hospitalId: { _id: string; name: string } | string;
  name: string;
  description: string;
}

export interface Hospital {
  _id: string;
  name: string;
  logoUrl?: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  phone: string;
  email: string;
  departments: Department[];
}

export interface Appointment {
  _id: string;
  appointmentId: string;
  patientId: {
    _id: string;
    userId: { name: string; email: string; phone: string };
    dateOfBirth: string;
    gender: string;
  };
  doctorId: {
    _id: string;
    userId: { name: string };
    specialization: string;
    departmentId: { name: string };
  };
  departmentId: { _id: string; name: string };
  hospitalId: { _id: string; name: string };
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
  symptoms: string[];
  priority: AppointmentPriority;
  requiresHumanReview: boolean;
  status: AppointmentStatus;
  notes?: string;
  followUpRequired?: boolean;
  createdAt: string;
}

export interface QueueEntry {
  _id: string;
  appointmentId: {
    _id: string;
    appointmentId: string;
    appointmentTime: string;
    reason: string;
    priority: AppointmentPriority;
  };
  patientId: {
    _id: string;
    userId: { name: string; phone: string };
    dateOfBirth: string;
    gender: string;
  };
  doctorId: {
    _id: string;
    userId: { name: string };
    specialization: string;
  };
  departmentId: { _id: string; name: string };
  priority: AppointmentPriority;
  queuePosition: number;
  estimatedWaitTime: number;
  status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'SKIPPED';
  checkedInAt?: string;
  completedAt?: string;
}

export interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PriorityAssessmentResult {
  id?: string;
  priority: AppointmentPriority;
  confidence: number;
  reason: string;
  factors: string[];
  requiresHumanReview: boolean;
}

export interface DashboardStats {
  todayAppointments: number;
  waitingPatients: number;
  highPriority: number;
  completed: number;
  totalUsers: number;
  totalPatients: number;
  noShowRate: number;
  avgWait: number;
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  targetId?: string;
  ipAddress?: string;
  at: string;
  actorId?: { name: string; email: string; role: string } | null;
}
