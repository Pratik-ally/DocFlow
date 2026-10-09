// Load .env.local first (same priority order as config/index.ts)
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config';

import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { Hospital } from '../models/Hospital';
import { Department } from '../models/Department';
import { Appointment } from '../models/Appointment';
import { QueueEntry } from '../models/QueueEntry';
import { PriorityAssessment } from '../models/PriorityAssessment';
import { Notification } from '../models/Notification';

const DEMO_PASSWORD = 'Demo@123';

const DAYS = (offset: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

async function seed(): Promise<void> {
  const safeUri = config.mongoUri.replace(/:\/\/[^@]+@/, '://***@'); // hide credentials
  console.log(`🔗 Connecting to: ${safeUri}`);
  await mongoose.connect(config.mongoUri);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    Doctor.deleteMany({}),
    Hospital.deleteMany({}),
    Department.deleteMany({}),
    Appointment.deleteMany({}),
    QueueEntry.deleteMany({}),
    PriorityAssessment.deleteMany({}),
    Notification.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ─── Hospital ───────────────────────────────────────────────────────────────
  const hospital = await Hospital.create({
    name: 'MediCare General Hospital',
    address: {
      street: '45, MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
    },
    phone: '+91-80-4567-8900',
    email: 'info@medicare-general.in',
    website: 'https://medicare-general.in',
    description: 'A leading multi-specialty hospital in Bengaluru providing world-class healthcare.',
    isActive: true,
  });

  // ─── Departments ─────────────────────────────────────────────────────────────
  const deptData = [
    { name: 'General Medicine', description: 'Primary care and general health consultations' },
    { name: 'Cardiology', description: 'Heart and cardiovascular system care' },
    { name: 'Orthopedics', description: 'Bone, joint, and musculoskeletal care' },
    { name: 'Pediatrics', description: 'Healthcare for infants, children, and adolescents' },
    { name: 'Dermatology', description: 'Skin, hair, and nail conditions' },
  ];

  const departments = await Department.insertMany(
    deptData.map((d) => ({ ...d, hospitalId: hospital._id, isActive: true }))
  );

  const deptMap: Record<string, mongoose.Types.ObjectId> = {};
  departments.forEach((d) => (deptMap[d.name] = d._id as mongoose.Types.ObjectId));

  await Hospital.findByIdAndUpdate(hospital._id, {
    departments: departments.map((d) => d._id),
  });

  // ─── Doctor users ─────────────────────────────────────────────────────────────
  const doctorData = [
    { name: 'Dr. Ananya Rao', dept: 'General Medicine', spec: 'General Physician', exp: 12, fee: 500, lic: 'MCI-KA-2012-001' },
    { name: 'Dr. Rahul Mehta', dept: 'Cardiology', spec: 'Interventional Cardiologist', exp: 15, fee: 1200, lic: 'MCI-KA-2009-002' },
    { name: 'Dr. Priya Nair', dept: 'Pediatrics', spec: 'Paediatric Specialist', exp: 10, fee: 600, lic: 'MCI-KA-2014-003' },
    { name: 'Dr. Arjun Kapoor', dept: 'Orthopedics', spec: 'Orthopaedic Surgeon', exp: 14, fee: 900, lic: 'MCI-KA-2010-004' },
    { name: 'Dr. Sneha Krishnan', dept: 'Dermatology', spec: 'Dermatologist', exp: 8, fee: 700, lic: 'MCI-KA-2016-005' },
    { name: 'Dr. Vikram Sharma', dept: 'Cardiology', spec: 'Cardiac Electrophysiologist', exp: 18, fee: 1500, lic: 'MCI-KA-2006-006' },
    { name: 'Dr. Meena Joshi', dept: 'General Medicine', spec: 'Internal Medicine', exp: 9, fee: 500, lic: 'MCI-KA-2015-007' },
    { name: 'Dr. Aditya Bose', dept: 'Orthopedics', spec: 'Sports Medicine Specialist', exp: 7, fee: 850, lic: 'MCI-KA-2017-008' },
  ];

  const availability = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => ({
    day,
    startTime: '09:00',
    endTime: '17:00',
    maxPatients: 20,
  }));

  const doctorUsers: mongoose.Document[] = [];
  const doctors: mongoose.Document[] = [];

  for (const d of doctorData) {
    const email = `${d.name.toLowerCase().replace(/\s+/g, '.').replace(/dr\./g, '').replace(/\./g, '_').replace(/_+/g, '_').trim()}_${d.lic.split('-')[3]}@medicare.in`;
    const user = await User.create({
      name: d.name,
      email,
      phone: `+91-98${Math.floor(10000000 + Math.random() * 89999999)}`,
      passwordHash: hash,
      role: 'DOCTOR',
      isActive: true,
    });
    doctorUsers.push(user);

    const doc = await Doctor.create({
      userId: user._id,
      hospitalId: hospital._id,
      departmentId: deptMap[d.dept],
      specialization: d.spec,
      licenseNumber: d.lic,
      qualifications: ['MBBS', 'MD'],
      experience: d.exp,
      availability,
      isAvailable: true,
      consultationFee: d.fee,
    });
    doctors.push(doc);
  }

  // ─── Demo doctor account ─────────────────────────────────────────────────────
  const demoDoctorUser = await User.create({
    name: 'Dr. Demo Doctor',
    email: 'doctor@demo.com',
    phone: '+91-9800000001',
    passwordHash: hash,
    role: 'DOCTOR',
    isActive: true,
  });
  const demoDoctor = await Doctor.create({
    userId: demoDoctorUser._id,
    hospitalId: hospital._id,
    departmentId: deptMap['General Medicine'],
    specialization: 'General Physician',
    licenseNumber: 'MCI-KA-DEMO-001',
    qualifications: ['MBBS', 'MD'],
    experience: 5,
    availability,
    isAvailable: true,
    consultationFee: 500,
  });

  // ─── Staff user ───────────────────────────────────────────────────────────────
  await User.create({
    name: 'Ravi Kumar (Staff)',
    email: 'staff@demo.com',
    phone: '+91-9800000002',
    passwordHash: hash,
    role: 'STAFF',
    isActive: true,
  });

  // ─── Admin user ───────────────────────────────────────────────────────────────
  await User.create({
    name: 'Admin User',
    email: 'admin@demo.com',
    phone: '+91-9800000003',
    passwordHash: hash,
    role: 'ADMIN',
    isActive: true,
  });

  // ─── Patients ─────────────────────────────────────────────────────────────────
  const patientData = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@email.com', dob: '1990-03-15', gender: 'MALE', phone: '+91-9811111101' },
    { name: 'Diya Patel', email: 'diya.patel@email.com', dob: '1985-07-22', gender: 'FEMALE', phone: '+91-9811111102' },
    { name: 'Rohan Kumar', email: 'rohan.kumar@email.com', dob: '1978-11-08', gender: 'MALE', phone: '+91-9811111103' },
    { name: 'Meera Iyer', email: 'meera.iyer@email.com', dob: '1995-01-30', gender: 'FEMALE', phone: '+91-9811111104' },
    { name: 'Karan Singh', email: 'karan.singh@email.com', dob: '1988-06-14', gender: 'MALE', phone: '+91-9811111105' },
    { name: 'Ananya Verma', email: 'ananya.verma@email.com', dob: '2002-09-25', gender: 'FEMALE', phone: '+91-9811111106' },
    { name: 'Arun Reddy', email: 'arun.reddy@email.com', dob: '1972-04-12', gender: 'MALE', phone: '+91-9811111107' },
    { name: 'Sunita Gupta', email: 'sunita.gupta@email.com', dob: '1968-12-03', gender: 'FEMALE', phone: '+91-9811111108' },
    { name: 'Nikhil Jain', email: 'nikhil.jain@email.com', dob: '1993-08-17', gender: 'MALE', phone: '+91-9811111109' },
    { name: 'Prachi Desai', email: 'prachi.desai@email.com', dob: '1999-05-28', gender: 'FEMALE', phone: '+91-9811111110' },
    { name: 'Suresh Nair', email: 'suresh.nair@email.com', dob: '1965-02-19', gender: 'MALE', phone: '+91-9811111111' },
    { name: 'Kavita Pillai', email: 'kavita.pillai@email.com', dob: '1980-10-07', gender: 'FEMALE', phone: '+91-9811111112' },
    { name: 'Vikrant Bajaj', email: 'vikrant.bajaj@email.com', dob: '2005-03-11', gender: 'MALE', phone: '+91-9811111113' },
    { name: 'Leela Krishnaswamy', email: 'leela.k@email.com', dob: '1958-07-04', gender: 'FEMALE', phone: '+91-9811111114' },
    { name: 'Rahul Tiwari', email: 'rahul.tiwari@email.com', dob: '1991-11-23', gender: 'MALE', phone: '+91-9811111115' },
    { name: 'Pooja Banerjee', email: 'pooja.banerjee@email.com', dob: '1987-04-16', gender: 'FEMALE', phone: '+91-9811111116' },
    { name: 'Deepak Malhotra', email: 'deepak.malhotra@email.com', dob: '1975-09-09', gender: 'MALE', phone: '+91-9811111117' },
    { name: 'Sarita Bose', email: 'sarita.bose@email.com', dob: '1962-06-27', gender: 'FEMALE', phone: '+91-9811111118' },
    { name: 'Aditya Rao', email: 'aditya.rao@email.com', dob: '2010-01-05', gender: 'MALE', phone: '+91-9811111119' },
    { name: 'Nandini Choudhary', email: 'nandini.c@email.com', dob: '1997-08-14', gender: 'FEMALE', phone: '+91-9811111120' },
  ];

  // Demo patient first
  const demoPatientUser = await User.create({
    name: 'Demo Patient',
    email: 'patient@demo.com',
    phone: '+91-9800000000',
    passwordHash: hash,
    role: 'PATIENT',
    isActive: true,
  });
  const demoPatient = await Patient.create({
    userId: demoPatientUser._id,
    dateOfBirth: new Date('1995-05-15'),
    gender: 'MALE',
    address: { street: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    emergencyContact: { name: 'Demo Emergency', phone: '+91-9800000099', relation: 'Spouse' },
    medicalHistory: ['Hypertension'],
    allergies: ['Penicillin'],
  });

  const allPatients: mongoose.Types.ObjectId[] = [demoPatient._id as mongoose.Types.ObjectId];
  const allPatientUserIds: mongoose.Types.ObjectId[] = [demoPatientUser._id as mongoose.Types.ObjectId];

  for (const p of patientData) {
    const user = await User.create({
      name: p.name,
      email: p.email,
      phone: p.phone,
      passwordHash: hash,
      role: 'PATIENT',
      isActive: true,
    });
    const patient = await Patient.create({
      userId: user._id,
      dateOfBirth: new Date(p.dob),
      gender: p.gender,
      address: { street: '123 Sample St', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      emergencyContact: { name: 'Family Member', phone: '+91-9800000099', relation: 'Family' },
    });
    allPatients.push(patient._id as mongoose.Types.ObjectId);
    allPatientUserIds.push(user._id as mongoose.Types.ObjectId);
  }

  console.log(`✅ Created ${allPatients.length} patients`);

  // ─── Appointments ─────────────────────────────────────────────────────────────
  const allDoctors = await Doctor.find({});
  const deptList = await Department.find({});

  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
  const priorities = ['ROUTINE', 'ROUTINE', 'ROUTINE', 'SOON', 'SOON', 'HIGH'] as const;
  const symptoms = [
    ['Fever', 'Cough', 'Fatigue'],
    ['Chest pain', 'Shortness of breath'],
    ['Joint pain', 'Swelling'],
    ['Skin rash', 'Itching'],
    ['Headache', 'Nausea'],
    ['Back pain', 'Stiffness'],
    ['Abdominal pain'],
    ['Sore throat', 'Runny nose'],
    ['Dizziness', 'Weakness'],
    ['Knee pain', 'Difficulty walking'],
  ];

  const reasons = [
    'Routine health checkup',
    'Follow-up consultation',
    'Chest discomfort for 2 days',
    'Persistent cough for 1 week',
    'Joint pain and swelling',
    'Skin rash spreading',
    'Severe headache episodes',
    'Back pain after injury',
    'Abdominal discomfort',
    'Pre-employment health screening',
  ];

  let appointmentCount = 0;

  // Today appointments — 6 assigned to demoDoctor, 4 round-robin across others
  const todayStatuses = ['CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'BOOKED', 'BOOKED', 'NO_SHOW'];
  const demoDoctorId = demoDoctor._id;
  for (let i = 0; i < 10; i++) {
    // First 6 slots go to demoDoctor so doctor@demo.com sees a full schedule
    const doctor = i < 6 ? { _id: demoDoctorId, departmentId: deptMap['General Medicine'] } : allDoctors[(i + 2) % allDoctors.length];
    const patient = allPatients[i % allPatients.length];
    const priority = priorities[i % priorities.length];
    await Appointment.create({
      appointmentId: `APT-${new Date().getFullYear()}-${10001 + appointmentCount}`,
      patientId: patient,
      doctorId: doctor._id,
      departmentId: doctor.departmentId,
      hospitalId: hospital._id,
      appointmentDate: DAYS(0),
      appointmentTime: timeSlots[i % timeSlots.length],
      reason: reasons[i % reasons.length],
      symptoms: symptoms[i % symptoms.length],
      priority,
      status: todayStatuses[i],
    });
    appointmentCount++;
  }

  // Tomorrow appointments
  for (let i = 0; i < 8; i++) {
    const doctor = allDoctors[(i + 2) % allDoctors.length];
    const patient = allPatients[(i + 5) % allPatients.length];
    await Appointment.create({
      appointmentId: `APT-${new Date().getFullYear()}-${10001 + appointmentCount}`,
      patientId: patient,
      doctorId: doctor._id,
      departmentId: doctor.departmentId,
      hospitalId: hospital._id,
      appointmentDate: DAYS(1),
      appointmentTime: timeSlots[(i + 3) % timeSlots.length],
      reason: reasons[(i + 2) % reasons.length],
      symptoms: symptoms[(i + 1) % symptoms.length],
      priority: priorities[(i + 1) % priorities.length],
      status: 'BOOKED',
    });
    appointmentCount++;
  }

  // This week
  for (let day = 2; day <= 5; day++) {
    for (let i = 0; i < 4; i++) {
      const doctor = allDoctors[(day + i) % allDoctors.length];
      const patient = allPatients[(day * 3 + i) % allPatients.length];
      await Appointment.create({
        appointmentId: `APT-${new Date().getFullYear()}-${10001 + appointmentCount}`,
        patientId: patient,
        doctorId: doctor._id,
        departmentId: doctor.departmentId,
        hospitalId: hospital._id,
        appointmentDate: DAYS(day),
        appointmentTime: timeSlots[i % timeSlots.length],
        reason: reasons[i % reasons.length],
        symptoms: symptoms[i % symptoms.length],
        priority: priorities[i % priorities.length],
        status: 'CONFIRMED',
      });
      appointmentCount++;
    }
  }

  // Past completed appointments
  for (let day = -7; day < 0; day++) {
    for (let i = 0; i < 3; i++) {
      const doctor = allDoctors[(Math.abs(day) + i) % allDoctors.length];
      const patient = allPatients[(Math.abs(day) * 2 + i) % allPatients.length];
      await Appointment.create({
        appointmentId: `APT-${new Date().getFullYear()}-${10001 + appointmentCount}`,
        patientId: patient,
        doctorId: doctor._id,
        departmentId: doctor.departmentId,
        hospitalId: hospital._id,
        appointmentDate: DAYS(day),
        appointmentTime: timeSlots[i % timeSlots.length],
        reason: reasons[(Math.abs(day) + i) % reasons.length],
        symptoms: symptoms[i % symptoms.length],
        priority: priorities[(Math.abs(day) + i) % priorities.length],
        status: Math.random() > 0.1 ? 'COMPLETED' : 'CANCELLED',
      });
      appointmentCount++;
    }
  }

  // Demo patient specific appointment - today
  const demoDoctorRecord = await Doctor.findOne({ userId: demoDoctorUser._id });
  const demoAppt = await Appointment.create({
    appointmentId: `APT-${new Date().getFullYear()}-20001`,
    patientId: demoPatient._id,
    doctorId: demoDoctorRecord?._id || allDoctors[0]._id,
    departmentId: deptMap['General Medicine'],
    hospitalId: hospital._id,
    appointmentDate: DAYS(0),
    appointmentTime: '14:30',
    reason: 'Routine health checkup',
    symptoms: ['Mild headache', 'Fatigue'],
    priority: 'ROUTINE',
    status: 'CONFIRMED',
  });

  console.log(`✅ Created ${appointmentCount + 1} appointments`);

  // ─── Queue entries (today) ────────────────────────────────────────────────────
  const todayAppts = await Appointment.find({
    appointmentDate: { $gte: DAYS(0), $lt: DAYS(1) },
    status: { $in: ['CHECKED_IN', 'WAITING', 'IN_CONSULTATION'] },
  });

  let position = 1;
  for (const appt of todayAppts) {
    await QueueEntry.create({
      appointmentId: appt._id,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      departmentId: appt.departmentId,
      priority: appt.priority,
      queuePosition: position,
      estimatedWaitTime: position * 12,
      status: appt.status === 'IN_CONSULTATION' ? 'IN_CONSULTATION' : 'WAITING',
      checkedInAt: new Date(),
      date: DAYS(0),
    });
    position++;
  }

  // Demo patient queue entry
  await QueueEntry.create({
    appointmentId: demoAppt._id,
    patientId: demoPatient._id,
    doctorId: demoDoctorRecord?._id || allDoctors[0]._id,
    departmentId: deptMap['General Medicine'],
    priority: 'ROUTINE',
    queuePosition: 4,
    estimatedWaitTime: 25,
    status: 'WAITING',
    checkedInAt: new Date(),
    date: DAYS(0),
  });

  console.log('✅ Created queue entries');

  // ─── Priority assessments ─────────────────────────────────────────────────────
  await PriorityAssessment.create({
    appointmentId: demoAppt._id,
    inputData: {
      symptoms: ['Mild headache', 'Fatigue'],
      reason: 'Routine health checkup',
      age: 29,
      gender: 'MALE',
      medicalHistory: ['Hypertension'],
      urgencyLevel: 'LOW',
    },
    suggestedPriority: 'ROUTINE',
    confidence: 0.82,
    reason: 'The submitted information is consistent with a routine appointment. Hospital staff will review before confirmation.',
    factors: ['No high-urgency symptoms detected', 'Pre-existing hypertension noted'],
    requiresHumanReview: false,
  });

  // ─── Notifications ────────────────────────────────────────────────────────────
  await Notification.insertMany([
    {
      userId: demoPatientUser._id,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment Confirmed',
      message: 'Your appointment with Dr. Demo Doctor is confirmed for today at 2:30 PM.',
      read: false,
    },
    {
      userId: demoPatientUser._id,
      type: 'QUEUE_UPDATED',
      title: 'Queue Updated',
      message: 'You are now #4 in the queue. Estimated wait time: 25 minutes.',
      read: false,
    },
    {
      userId: demoPatientUser._id,
      type: 'APPOINTMENT_REMINDER',
      title: 'Appointment Reminder',
      message: 'Your appointment starts in 30 minutes. Please check in at reception.',
      read: true,
    },
  ]);

  console.log('✅ Created notifications');
  console.log('\n🎉 Seed complete!');
  console.log('\n🔑 Demo accounts:');
  console.log('   patient@demo.com  / Demo@123');
  console.log('   doctor@demo.com   / Demo@123');
  console.log('   staff@demo.com    / Demo@123');
  console.log('   admin@demo.com    / Demo@123\n');

  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
