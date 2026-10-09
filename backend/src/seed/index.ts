import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { User } from '../models/User';
import type { IUser } from '../models/User';
import { Patient } from '../models/Patient';
import type { IPatient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import type { IDoctor } from '../models/Doctor';
import { Hospital } from '../models/Hospital';
import { Department } from '../models/Department';
import { Appointment } from '../models/Appointment';
import type { AppointmentStatus, AppointmentPriority, IAppointment } from '../models/Appointment';
import { QueueEntry } from '../models/QueueEntry';
import { PriorityAssessment } from '../models/PriorityAssessment';
import { Notification } from '../models/Notification';
import { AuditLog } from '../models/AuditLog';
import { Invite } from '../models/Invite';

const DEMO_HOSPITAL_NAME = 'MediCare General Hospital';
const OWNER_EMAIL = 'owner@medicare-demo.example.com';
const ADMIN_EMAILS = ['admin1@medicare-demo.example.com', 'admin2@medicare-demo.example.com'];
const STAFF_EMAILS = ['reception@medicare-demo.example.com', 'nurse@medicare-demo.example.com'];
const DOCTOR_EMAILS = [
  'doctor.general@medicare-demo.example.com',
  'doctor.cardiology@medicare-demo.example.com',
  'doctor.orthopedics@medicare-demo.example.com',
  'doctor.pediatrics@medicare-demo.example.com',
  'doctor.removed@medicare-demo.example.com',
];
const DEMO_STAFF_EMAILS = [OWNER_EMAIL, ...ADMIN_EMAILS, ...STAFF_EMAILS, ...DOCTOR_EMAILS];
const PATIENT_EMAILS = [
  'patient1@medicare-demo.example.com',
  'patient2@medicare-demo.example.com',
  'patient3@medicare-demo.example.com',
  'patient4@medicare-demo.example.com',
  'patient5@medicare-demo.example.com',
  'patient6@medicare-demo.example.com',
];

if (process.env.NODE_ENV === 'production') {
  console.error('Seed script is disabled in production (NODE_ENV=production).');
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medipriority';
const daysFromToday = (offset: number): Date => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};

async function clearDemoData(): Promise<void> {
  const [owner, demoStaffUsers, demoPatientUsers] = await Promise.all([
    User.findOne({ email: OWNER_EMAIL, role: 'OWNER' }).select('_id'),
    User.find({ email: { $in: DEMO_STAFF_EMAILS } }).select('_id'),
    User.find({ email: { $in: PATIENT_EMAILS }, role: 'PATIENT' }).select('_id'),
  ]);
  const hospital = owner
    ? await Hospital.findOne({ name: DEMO_HOSPITAL_NAME, ownerId: owner._id }).select('_id')
    : null;
  const demoStaffUserIds = demoStaffUsers.map((user) => user._id);
  const demoPatientUserIds = demoPatientUsers.map((user) => user._id);

  if (!hospital) {
    const patients = await Patient.find({ userId: { $in: demoPatientUserIds } }).select('_id');
    const patientIds = patients.map((patient) => patient._id);
    const userIds = [...demoStaffUserIds, ...demoPatientUserIds];
    await Promise.all([
      Notification.deleteMany({ userId: { $in: userIds } }),
      Patient.deleteMany({ _id: { $in: patientIds } }),
      Doctor.deleteMany({ userId: { $in: demoStaffUserIds } }),
      User.deleteMany({ _id: { $in: userIds } }),
    ]);
    return;
  }

  const hospitalId = hospital._id;
  const [hospitalUsers, hospitalDoctors] = await Promise.all([
    User.find({ hospitalId }).select('_id'),
    Doctor.find({ hospitalId }).select('_id'),
  ]);
  const hospitalUserIds = hospitalUsers.map((user) => user._id);
  const patients = await Patient.find({
    userId: { $in: demoPatientUserIds },
  }).select('_id userId');
  const patientProfileIds = patients.map((patient) => patient._id);
  const userIds = [...new Set(
    [...hospitalUserIds, ...demoStaffUserIds, ...demoPatientUserIds].map((id) => id.toString())
  )].map((id) => new mongoose.Types.ObjectId(id));

  await Promise.all([
    QueueEntry.deleteMany({ hospitalId }),
    PriorityAssessment.deleteMany({ hospitalId }),
    Notification.deleteMany({ userId: { $in: userIds } }),
    AuditLog.deleteMany({ hospitalId }),
    Invite.deleteMany({ hospitalId }),
    Appointment.deleteMany({ hospitalId }),
    Patient.deleteMany({ _id: { $in: patientProfileIds } }),
    Doctor.deleteMany({ _id: { $in: hospitalDoctors.map((doctor) => doctor._id) } }),
    Department.deleteMany({ hospitalId }),
    Hospital.deleteOne({ _id: hospitalId }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
}

async function seed(): Promise<void> {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_PASSWORD to a value of at least 12 characters in backend/.env.local before seeding.');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB. Resetting demo-hospital data only.');
  await clearDemoData();

  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const ownerId = new mongoose.Types.ObjectId();
  const hospital = await Hospital.create({
    ownerId,
    name: DEMO_HOSPITAL_NAME,
    address: {
      street: '45 Demo Avenue',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
    },
    phone: '+91-80-5550-0100',
    email: 'hello@medicare-demo.example.com',
    description: 'Fictional hospital used for local software demonstrations.',
    isActive: true,
  });

  const departmentNames = [
    'General Medicine',
    'Cardiology',
    'Orthopedics',
    'Pediatrics',
    'Dermatology',
  ];
  const departments = await Department.insertMany(departmentNames.map((name) => ({
    name,
    description: `${name} outpatient consultations`,
    hospitalId: hospital._id,
    isActive: true,
  })));
  const departmentByName = new Map(departments.map((department) => [department.name, department]));
  await Hospital.updateOne(
    { _id: hospital._id },
    { $set: { departments: departments.map((department) => department._id) } }
  );

  const owner = await User.create({
    _id: ownerId,
    name: 'Demo Hospital Owner',
    email: OWNER_EMAIL,
    phone: '+91-90000-00001',
    passwordHash,
    role: 'OWNER',
    hospitalId: hospital._id,
    status: 'ACTIVE',
  });

  const admins = await User.insertMany(ADMIN_EMAILS.map((email, index) => ({
    name: `Demo Admin ${index + 1}`,
    email,
    phone: `+91-90000-0000${index + 2}`,
    passwordHash,
    role: 'ADMIN' as const,
    hospitalId: hospital._id,
    status: 'ACTIVE' as const,
  })));

  const staff = await User.insertMany(STAFF_EMAILS.map((email, index) => ({
    name: index === 0 ? 'Demo Receptionist' : 'Demo Nurse',
    email,
    phone: `+91-90000-0000${index + 4}`,
    passwordHash,
    role: 'STAFF' as const,
    hospitalId: hospital._id,
    status: 'ACTIVE' as const,
    department: index === 0 ? 'Reception' : 'Nursing',
  })));

  const doctorSpecs = [
    { name: 'Dr. Demo Generalist', department: 'General Medicine', specialization: 'General Physician' },
    { name: 'Dr. Demo Cardiologist', department: 'Cardiology', specialization: 'Cardiologist' },
    { name: 'Dr. Demo Orthopedist', department: 'Orthopedics', specialization: 'Orthopedic Specialist' },
    { name: 'Dr. Demo Pediatrician', department: 'Pediatrics', specialization: 'Pediatrician' },
    { name: 'Dr. Demo Dermatologist', department: 'Dermatology', specialization: 'Dermatologist', removed: true },
  ];
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const availability = weekDays.map((day) => ({
    day,
    startTime: '09:00',
    endTime: '17:00',
    maxPatients: 20,
  }));
  const doctorUsers: IUser[] = [];
  const doctors: IDoctor[] = [];

  for (const [index, spec] of doctorSpecs.entries()) {
    const user = await User.create({
      name: spec.name,
      email: DOCTOR_EMAILS[index],
      phone: `+91-90000-000${10 + index}`,
      passwordHash,
      role: 'DOCTOR',
      hospitalId: hospital._id,
      status: spec.removed ? 'REMOVED' : 'ACTIVE',
      ...(spec.removed ? { removedAt: new Date(), removedBy: owner._id } : {}),
      department: spec.department,
      specialization: spec.specialization,
    });
    const department = departmentByName.get(spec.department);
    if (!department) {
      throw new Error(`Missing seeded department: ${spec.department}`);
    }
    const doctor = await Doctor.create({
      userId: user._id,
      hospitalId: hospital._id,
      departmentId: department._id,
      specialization: spec.specialization,
      licenseNumber: `DEMO-LIC-${String(index + 1).padStart(3, '0')}`,
      qualifications: ['MBBS', 'MD'],
      experience: 8 + index,
      availability,
      isAvailable: !spec.removed,
      consultationFee: 500 + index * 100,
    });
    doctorUsers.push(user);
    doctors.push(doctor);
  }

  const patientSpecs = [
    { name: 'Alex Morgan', dob: '1990-03-15', gender: 'MALE' as const },
    { name: 'Jamie Taylor', dob: '1985-07-22', gender: 'FEMALE' as const },
    { name: 'Casey Jordan', dob: '1978-11-08', gender: 'OTHER' as const },
    { name: 'Riley Parker', dob: '1995-01-30', gender: 'FEMALE' as const },
    { name: 'Avery Quinn', dob: '1988-06-14', gender: 'MALE' as const },
    { name: 'Morgan Ellis', dob: '2002-09-25', gender: 'FEMALE' as const },
  ];
  const patients: IPatient[] = [];
  const patientUsers: IUser[] = [];
  for (const [index, spec] of patientSpecs.entries()) {
    const user = await User.create({
      name: spec.name,
      email: PATIENT_EMAILS[index],
      phone: `+1-555-010-${String(index + 1).padStart(2, '0')}`,
      passwordHash,
      role: 'PATIENT',
    });
    const patient = await Patient.create({
      userId: user._id,
      dateOfBirth: new Date(spec.dob),
      gender: spec.gender,
      address: { street: '100 Demo Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      emergencyContact: { name: 'Demo Contact', phone: '+1-555-010-0099', relation: 'Family' },
    });
    patientUsers.push(user);
    patients.push(patient);
  }

  const activeDoctors = doctors.slice(0, 4);
  const removedDoctor = doctors[4];
  const appointmentStatuses: AppointmentStatus[] = [
    'CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'COMPLETED',
    'BOOKED', 'CANCELLED', 'WAITING', 'CHECKED_IN', 'CONFIRMED',
  ];
  const priorities: AppointmentPriority[] = ['ROUTINE', 'SOON', 'HIGH', 'ROUTINE', 'HIGH'];
  const reasons = [
    'Routine wellness consultation',
    'Follow-up appointment',
    'Persistent cough and fatigue',
    'Joint discomfort',
    'Skin irritation',
    'Seasonal allergy symptoms',
  ];
  const symptoms = [
    ['Fatigue', 'Headache'],
    ['Cough', 'Sore throat'],
    ['Joint pain'],
    ['Skin irritation'],
    ['Runny nose', 'Sneezing'],
    ['Back discomfort'],
  ];
  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
  let appointmentNumber = 0;
  const todayAppointments: IAppointment[] = [];

  const addAppointment = async (
    doctorIndex: number,
    patientIndex: number,
    dayOffset: number,
    timeIndex: number,
    status: AppointmentStatus
  ) => {
    const doctor = dayOffset < 0 ? removedDoctor : activeDoctors[doctorIndex % activeDoctors.length];
    const patient = patients[patientIndex % patients.length];
    const appointment = await Appointment.create({
      appointmentId: `DEMO-${new Date().getUTCFullYear()}-${String(++appointmentNumber).padStart(4, '0')}`,
      patientId: patient._id,
      doctorId: doctor._id,
      departmentId: doctor.departmentId,
      hospitalId: hospital._id,
      appointmentDate: daysFromToday(dayOffset),
      appointmentTime: timeSlots[timeIndex % timeSlots.length],
      reason: reasons[(appointmentNumber - 1) % reasons.length],
      symptoms: symptoms[(appointmentNumber - 1) % symptoms.length],
      priority: priorities[(appointmentNumber - 1) % priorities.length],
      status,
    });
    if (dayOffset === 0) todayAppointments.push(appointment);
    return appointment;
  };

  for (const [index, status] of appointmentStatuses.entries()) {
    await addAppointment(index % 4, index, 0, Math.floor(index / 4), status);
  }

  for (let day = 1; day <= 6; day++) {
    await addAppointment(day % 4, day, day, 0, day === 3 ? 'CANCELLED' : 'BOOKED');
    await addAppointment((day + 1) % 4, day + 2, day, 1, 'CONFIRMED');
  }

  await addAppointment(0, 4, -3, 0, 'COMPLETED');
  await addAppointment(0, 5, -1, 1, 'COMPLETED');
  await addAppointment(0, 3, -1, 2, 'CANCELLED');
  if (appointmentNumber !== 25) {
    throw new Error(`Expected to seed 25 demo appointments; created ${appointmentNumber}.`);
  }

  const queuedAppointments = todayAppointments
    .filter((appointment) => ['CHECKED_IN', 'WAITING', 'IN_CONSULTATION'].includes(appointment.status))
    .sort((left, right) => priorities.indexOf(right.priority) - priorities.indexOf(left.priority));
  await QueueEntry.insertMany(queuedAppointments.map((appointment, index) => ({
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    departmentId: appointment.departmentId,
    hospitalId: hospital._id,
    priority: appointment.priority,
    queuePosition: index + 1,
    estimatedWaitTime: index * 12,
    status: appointment.status === 'IN_CONSULTATION' ? 'IN_CONSULTATION' : 'WAITING',
    checkedInAt: new Date(),
    date: daysFromToday(0),
  })));

  const inviteToken = crypto.randomBytes(32).toString('hex');
  await Invite.create({
    email: 'pending.staff@medicare-demo.example.com',
    role: 'STAFF',
    department: 'Reception',
    tokenHash: crypto.createHash('sha256').update(inviteToken).digest('hex'),
    hospitalId: hospital._id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    invitedBy: owner._id,
  });

  const auditSamples = [
    { actorId: owner._id, action: 'TEAM_INVITE_CREATED', targetId: admins[0]._id },
    { actorId: owner._id, action: 'TEAM_MEMBER_REACTIVATED', targetId: staff[0]._id },
    { actorId: admins[0]._id, action: 'TEAM_MEMBER_UPDATED', targetId: doctorUsers[0]._id },
    { actorId: owner._id, action: 'TEAM_MEMBER_REMOVED', targetId: doctorUsers[4]._id },
  ];
  await AuditLog.insertMany(auditSamples.map((entry, index) => ({
    ...entry,
    hospitalId: hospital._id,
    at: new Date(Date.now() - index * 60 * 60 * 1000),
    ipAddress: '127.0.0.1',
  })));

  await Notification.insertMany([
    {
      userId: patientUsers[0]._id,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment confirmed',
      message: 'Your demo appointment is confirmed.',
      relatedId: todayAppointments[0]._id,
      relatedModel: 'Appointment',
    },
    {
      userId: patientUsers[1]._id,
      type: 'QUEUE_UPDATED',
      title: 'Queue position updated',
      message: 'Your demo queue position is ready to view.',
      relatedId: todayAppointments[2]._id,
      relatedModel: 'Appointment',
    },
    {
      userId: staff[0]._id,
      type: 'GENERAL',
      title: 'Demo environment ready',
      message: 'Use this local environment to explore the staff workflow.',
    },
  ]);

  console.log('Seed complete: 1 demo hospital, 2 admins, 4 active doctors, 1 removed doctor, 2 staff, 6 patients, 25 appointments.');
  console.log('No invite token or password is printed. The pending invite expires in 24 hours.');
  await mongoose.disconnect();
}

seed().catch(async (error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.name : 'Unknown error');
  await mongoose.disconnect();
  process.exitCode = 1;
});
