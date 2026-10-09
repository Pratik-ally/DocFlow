import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, Server } from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Appointment } from '../models/Appointment';
import { AuditLog } from '../models/AuditLog';
import { Department } from '../models/Department';
import { Hospital } from '../models/Hospital';
import { Invite } from '../models/Invite';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { config } from '../config';
import { assessPriorityForBooking } from '../ai/priorityEngine';
import authRoutes from '../routes/auth';
import appointmentRoutes from '../routes/appointments';
import teamRoutes from '../routes/team';
import staffRoutes from '../routes/staff';
import inviteRoutes from '../routes/invites';
import adminRoutes from '../routes/admin';
import hospitalRoutes from '../routes/hospital';
import {
  createFailedLoginUpdatePipeline,
  isCurrentSessionVersion,
  LOGIN_LOCKOUT_DURATION_MS,
  MAX_LOGIN_FAILURES,
} from '../validation/authSecurity';

const HOSPITAL_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_HOSPITAL_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const protectedEndpoints = [
  { method: 'GET', path: '/api/team' },
  { method: 'POST', path: '/api/team' },
  { method: 'POST', path: '/api/team/admins' },
  { method: 'PATCH', path: '/api/team/cccccccccccccccccccccccc' },
  { method: 'POST', path: '/api/team/cccccccccccccccccccccccc/remove' },
  { method: 'POST', path: '/api/team/cccccccccccccccccccccccc/reactivate' },
  { method: 'GET', path: '/api/admin/audit-log' },
  { method: 'POST', path: '/api/staff/logout' },
  { method: 'GET', path: '/api/hospital/manage' },
  { method: 'PATCH', path: '/api/hospital' },
  { method: 'POST', path: '/api/departments' },
] as const;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api', hospitalRoutes);

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

function stubDatabaseUser(user: Record<string, unknown>): void {
  Object.defineProperty(User, 'findById', {
    configurable: true,
    value: () => ({ select: async () => user }),
  });
}

function makeToken(
  hospitalId?: string,
  role = 'OWNER',
  portal = 'staff',
  sessionVersion = 0
): string {
  return jwt.sign(
    {
      id: 'dddddddddddddddddddddddd',
      email: 'admin@example.test',
      role,
      name: 'Test Admin',
      hospitalId,
      sessionVersion,
      portal,
    },
    config.jwtSecret
  );
}

async function callEndpoint(
  method: string,
  path: string,
  token: string,
  body?: Record<string, unknown>
): Promise<globalThis.Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: `staff_token=${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

for (const endpoint of protectedEndpoints) {
  test(`${endpoint.method} ${endpoint.path} rejects the wrong database role`, async () => {
    stubDatabaseUser({
      _id: 'dddddddddddddddddddddddd',
      name: 'Patient',
      email: 'patient@example.test',
      role: 'PATIENT',
      status: 'ACTIVE',
      sessionVersion: 0,
    });
    const response = await callEndpoint(endpoint.method, endpoint.path, makeToken(undefined, 'OWNER', 'patient'));
    assert.equal(response.status, 403);
  });

  test(`${endpoint.method} ${endpoint.path} rejects a removed database user`, async () => {
    stubDatabaseUser({
      _id: 'dddddddddddddddddddddddd',
      name: 'Removed Admin',
      email: 'admin@example.test',
      role: 'ADMIN',
      status: 'REMOVED',
      hospitalId: HOSPITAL_ID,
      sessionVersion: 0,
    });
    const response = await callEndpoint(endpoint.method, endpoint.path, makeToken(HOSPITAL_ID));
    assert.equal(response.status, 401);
  });

  test(`${endpoint.method} ${endpoint.path} rejects a token for another hospital`, async () => {
    stubDatabaseUser({
      _id: 'dddddddddddddddddddddddd',
      name: 'Admin',
      email: 'admin@example.test',
      role: 'ADMIN',
      status: 'ACTIVE',
      hospitalId: HOSPITAL_ID,
      sessionVersion: 0,
    });
    const response = await callEndpoint(endpoint.method, endpoint.path, makeToken(OTHER_HOSPITAL_ID));
    assert.equal(response.status, 401);
  });
}

test('hospital profile updates reject non-raster logo data before writing', async () => {
  stubDatabaseUser({
    _id: 'dddddddddddddddddddddddd',
    name: 'Test Owner',
    email: 'owner@example.test',
    role: 'OWNER',
    status: 'ACTIVE',
    hospitalId: HOSPITAL_ID,
    sessionVersion: 0,
  });
  const response = await callEndpoint('PATCH', '/api/hospital', makeToken(HOSPITAL_ID), {
    name: 'Test Hospital',
    location: {
      addressLine1: '1 Main Street',
      addressLine2: '',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      postalCode: '12345',
    },
    logoUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  });
  assert.equal(response.status, 400);
});

test('department creation rejects malformed input before database access', async () => {
  stubDatabaseUser({
    _id: 'dddddddddddddddddddddddd',
    name: 'Test Owner',
    email: 'owner@example.test',
    role: 'OWNER',
    status: 'ACTIVE',
    hospitalId: HOSPITAL_ID,
    sessionVersion: 0,
  });
  const response = await callEndpoint('POST', '/api/departments', makeToken(HOSPITAL_ID), {
    name: { $ne: null },
  });
  assert.equal(response.status, 400);
});

test('an owner can add a department to only their hospital', async () => {
  stubDatabaseUser({
    _id: 'dddddddddddddddddddddddd',
    name: 'Test Owner',
    email: 'owner@example.test',
    role: 'OWNER',
    status: 'ACTIVE',
    hospitalId: HOSPITAL_ID,
    sessionVersion: 0,
  });

  const originalHospitalFindOne = Object.getOwnPropertyDescriptor(Hospital, 'findOne');
  const originalHospitalUpdateOne = Object.getOwnPropertyDescriptor(Hospital, 'updateOne');
  const originalDepartmentFindOne = Object.getOwnPropertyDescriptor(Department, 'findOne');
  const originalDepartmentCreate = Object.getOwnPropertyDescriptor(Department, 'create');
  const originalAuditCreate = Object.getOwnPropertyDescriptor(AuditLog, 'create');
  let hospitalUpdate: Record<string, unknown> | undefined;

  Object.defineProperty(Hospital, 'findOne', {
    configurable: true,
    value: () => ({ select: async () => ({ _id: HOSPITAL_ID }) }),
  });
  Object.defineProperty(Hospital, 'updateOne', {
    configurable: true,
    value: async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      assert.equal(filter._id, HOSPITAL_ID);
      hospitalUpdate = update;
    },
  });
  Object.defineProperty(Department, 'findOne', {
    configurable: true,
    value: () => ({ select: async () => null }),
  });
  Object.defineProperty(Department, 'create', {
    configurable: true,
    value: async (documents: Array<Record<string, unknown>>) => [{
      _id: 'eeeeeeeeeeeeeeeeeeeeeeee',
      ...documents[0],
    }],
  });
  Object.defineProperty(AuditLog, 'create', {
    configurable: true,
    value: async () => undefined,
  });

  try {
    const response = await callEndpoint('POST', '/api/departments', makeToken(HOSPITAL_ID), {
      name: 'Cardiology',
      description: 'Heart care',
    });
    const body = await response.json() as {
      success: boolean;
      department: { name: string; hospitalId: string };
    };
    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.department.name, 'Cardiology');
    assert.equal(body.department.hospitalId, HOSPITAL_ID);
    assert.ok(hospitalUpdate);
  } finally {
    for (const [model, method, descriptor] of [
      [Hospital, 'findOne', originalHospitalFindOne],
      [Hospital, 'updateOne', originalHospitalUpdateOne],
      [Department, 'findOne', originalDepartmentFindOne],
      [Department, 'create', originalDepartmentCreate],
      [AuditLog, 'create', originalAuditCreate],
    ] as const) {
      if (descriptor) Object.defineProperty(model, method, descriptor);
      else Reflect.deleteProperty(model, method);
    }
  }
});

test('protected APIs reject a session with an outdated database sessionVersion', async () => {
  stubDatabaseUser({
    _id: 'dddddddddddddddddddddddd',
    name: 'Reset User',
    email: 'reset@example.test',
    role: 'ADMIN',
    status: 'ACTIVE',
    hospitalId: HOSPITAL_ID,
    sessionVersion: 2,
  });
  const response = await callEndpoint(
    'GET',
    '/api/team',
    makeToken(HOSPITAL_ID, 'ADMIN', 'staff', 1)
  );
  assert.equal(response.status, 401);
});

async function rejectUnavailableInvite() {
  const original = Invite.findOneAndUpdate;
  let query: Record<string, unknown> | undefined;
  Object.defineProperty(Invite, 'findOneAndUpdate', {
    configurable: true,
    value: (filter: Record<string, unknown>) => {
      query = filter;
      return Promise.resolve(null);
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/invites/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'a'.repeat(64),
        name: 'Test User',
        phone: '+12345678900',
        password: 'StrongPassword1!',
      }),
    });
    assert.equal(response.status, 400);
    const responseBody = await response.json() as { message?: unknown };
    assert.equal(responseBody.message, 'Invalid or expired invite');
    assert.deepEqual(query?.usedAt, { $exists: false });
    assert.ok((query?.expiresAt as { $gt?: Date } | undefined)?.$gt instanceof Date);
  } finally {
    Object.defineProperty(Invite, 'findOneAndUpdate', {
      configurable: true,
      value: original,
    });
  }
}

test('POST /api/invites/accept rejects expired invites', rejectUnavailableInvite);
test('POST /api/invites/accept rejects reused invites', rejectUnavailableInvite);

test('patient login rejects staff accounts with the same generic response', async () => {
  const originalFindOne = User.findOne;
  Object.defineProperty(User, 'findOne', {
    configurable: true,
    value: () => Promise.resolve(null),
  });
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'Incorrect123!' }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { success: false, message: 'Invalid credentials' });
  } finally {
    Object.defineProperty(User, 'findOne', { configurable: true, value: originalFindOne });
  }
});

test('staff login rejects patient accounts with the same generic response', async () => {
  const originalFind = User.find;
  Object.defineProperty(User, 'find', {
    configurable: true,
    value: () => ({
      limit: async () => [],
    }),
  });
  try {
    const response = await fetch(`${baseUrl}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'patient@example.test', password: 'Incorrect123!' }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { success: false, message: 'Invalid credentials' });
  } finally {
    Object.defineProperty(User, 'find', { configurable: true, value: originalFind });
  }
});

test('staff login atomically locks the account after five failed attempts', async () => {
  const originalFind = User.find;
  const originalUpdateOne = User.updateOne;
  const originalAuditCreate = AuditLog.create;
  const hash = await bcrypt.hash('CorrectPassword123!', 4);
  const user = {
    _id: 'dddddddddddddddddddddddd',
    email: 'admin@example.test',
    name: 'Test Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    hospitalId: HOSPITAL_ID,
    passwordHash: hash,
    failedLoginCount: 0,
    lockedUntil: undefined as Date | undefined,
    sessionVersion: 0,
  };
  Object.defineProperty(User, 'find', {
    configurable: true,
    value: () => ({
      limit: async () => [user],
    }),
  });
  Object.defineProperty(User, 'updateOne', {
    configurable: true,
    value: async (
      filter: Record<string, unknown>,
      pipeline: Array<Record<string, unknown>>
    ) => {
      assert.equal(filter._id, user._id);
      assert.ok(Array.isArray(pipeline));
      assert.ok('$or' in filter);
      const nextAttempt = user.failedLoginCount + 1;
      if (nextAttempt >= MAX_LOGIN_FAILURES) {
        user.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS);
        user.failedLoginCount = 0;
      } else {
        user.failedLoginCount = nextAttempt;
      }
      return { modifiedCount: 1 };
    },
  });
  Object.defineProperty(AuditLog, 'create', {
    configurable: true,
    value: async () => ({}),
  });
  try {
    for (let attempt = 0; attempt < MAX_LOGIN_FAILURES; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/staff-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: 'WrongPassword123!' }),
      });
      assert.equal(response.status, 401);
    }
    assert.ok(user.lockedUntil instanceof Date);
    assert.ok(user.lockedUntil > new Date());
  } finally {
    Object.defineProperty(User, 'find', { configurable: true, value: originalFind });
    Object.defineProperty(User, 'updateOne', { configurable: true, value: originalUpdateOne });
    Object.defineProperty(AuditLog, 'create', { configurable: true, value: originalAuditCreate });
  }
});

test('patient login locks the account after five failed attempts', async () => {
  const originalFindOne = User.findOne;
  const originalUpdateOne = User.updateOne;
  const hash = await bcrypt.hash('CorrectPassword123!', 4);
  const user = {
    _id: 'dddddddddddddddddddddddd',
    email: 'patient@example.test',
    name: 'Test Patient',
    role: 'PATIENT',
    status: 'ACTIVE',
    passwordHash: hash,
    failedLoginCount: 0,
    lockedUntil: undefined as Date | undefined,
    sessionVersion: 0,
  };
  Object.defineProperty(User, 'findOne', {
    configurable: true,
    value: () => Promise.resolve(user),
  });
  Object.defineProperty(User, 'updateOne', {
    configurable: true,
    value: async (
      filter: Record<string, unknown>,
      pipeline: Array<Record<string, unknown>>
    ) => {
      assert.equal(filter._id, user._id);
      assert.ok(Array.isArray(pipeline));
      assert.ok('$or' in filter);
      const nextAttempt = user.failedLoginCount + 1;
      if (nextAttempt >= MAX_LOGIN_FAILURES) {
        user.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS);
        user.failedLoginCount = 0;
      } else {
        user.failedLoginCount = nextAttempt;
      }
      return { modifiedCount: 1 };
    },
  });
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: 'WrongPassword123!' }),
      });
      assert.equal(response.status, 401);
    }
    assert.ok(user.lockedUntil instanceof Date);
    assert.ok(user.lockedUntil > new Date());

    const lockedResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'CorrectPassword123!' }),
    });
    assert.equal(lockedResponse.status, 401);
    assert.deepEqual(await lockedResponse.json(), { success: false, message: 'Invalid credentials' });
  } finally {
    Object.defineProperty(User, 'findOne', { configurable: true, value: originalFindOne });
    Object.defineProperty(User, 'updateOne', { configurable: true, value: originalUpdateOne });
  }
});

test('failed-login Mongo update pipeline increments atomically and sets lockout at five', () => {
  const lockout = new Date('2030-01-01T00:15:00.000Z');
  const pipeline = createFailedLoginUpdatePipeline(lockout);
  assert.equal(pipeline.length, 2);
  assert.deepEqual(pipeline[0], {
    $set: {
      failedLoginCount: {
        $add: [{ $ifNull: ['$failedLoginCount', 0] }, 1],
      },
    },
  });
  assert.deepEqual(pipeline[1], {
    $set: {
      lockedUntil: {
        $cond: [
          { $gte: ['$failedLoginCount', MAX_LOGIN_FAILURES] },
          { $literal: lockout },
          '$lockedUntil',
        ],
      },
      failedLoginCount: {
        $cond: [
          { $gte: ['$failedLoginCount', MAX_LOGIN_FAILURES] },
          0,
          '$failedLoginCount',
        ],
      },
    },
  });
});

test('an Auth.js session version is valid only while it matches the database version', () => {
  assert.equal(isCurrentSessionVersion(0, 0), true);
  assert.equal(isCurrentSessionVersion(3, 3), true);
  assert.equal(isCurrentSessionVersion(2, 3), false);
  assert.equal(isCurrentSessionVersion(undefined, 0), false);
  assert.equal(isCurrentSessionVersion(1.5, 1.5), false);
});

test('patients cannot retrieve another patient appointment by ID', async () => {
  const originalFindById = User.findById;
  const originalPatientFindOne = Patient.findOne;
  const originalAppointmentFindOne = Appointment.findOne;
  let queriedPatientId: unknown;
  stubDatabaseUser({
    _id: 'dddddddddddddddddddddddd',
    name: 'Patient',
    email: 'patient@example.test',
    role: 'PATIENT',
    status: 'ACTIVE',
    sessionVersion: 0,
  });
  Object.defineProperty(Patient, 'findOne', {
    configurable: true,
    value: () => ({ select: async () => ({ _id: 'eeeeeeeeeeeeeeeeeeeeeeee' }) }),
  });
  Object.defineProperty(Appointment, 'findOne', {
    configurable: true,
    value: (filter: Record<string, unknown>) => {
      queriedPatientId = filter.patientId;
      return {
        populate() {
          return this;
        },
        then(resolve: (value: null) => unknown) {
          return Promise.resolve(null).then(resolve);
        },
      };
    },
  });
  try {
    const response = await fetch(`${baseUrl}/api/appointments/ffffffffffffffffffffffff`, {
      headers: { Cookie: `token=${makeToken(undefined, 'PATIENT', 'patient')}` },
    });
    assert.equal(response.status, 404);
    assert.equal(queriedPatientId, 'eeeeeeeeeeeeeeeeeeeeeeee');
  } finally {
    Object.defineProperty(User, 'findById', { configurable: true, value: originalFindById });
    Object.defineProperty(Patient, 'findOne', { configurable: true, value: originalPatientFindOne });
    Object.defineProperty(Appointment, 'findOne', { configurable: true, value: originalAppointmentFindOne });
  }
});

test('appointment booking rejects an already-booked doctor time slot', async () => {
  const originalFindById = User.findById;
  const originalUserExists = User.exists;
  const originalPatientFindOne = Patient.findOne;
  const originalDoctorFindOne = (await import('../models/Doctor')).Doctor.findOne;
  const originalAppointmentFindOne = Appointment.findOne;
  const originalAppointmentCreate = Appointment.create;
  let createCalled = false;
  stubDatabaseUser({
    _id: 'dddddddddddddddddddddddd',
    name: 'Patient',
    email: 'patient@example.test',
    role: 'PATIENT',
    status: 'ACTIVE',
    sessionVersion: 0,
  });

  Object.defineProperty(Patient, 'findOne', {
    configurable: true,
    value: () => Promise.resolve({ _id: 'eeeeeeeeeeeeeeeeeeeeeeee' }),
  });
  const { Doctor } = await import('../models/Doctor');
  Object.defineProperty(Doctor, 'findOne', {
    configurable: true,
    value: () => ({ select: async () => ({ _id: 'cccccccccccccccccccccccc', userId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }) }),
  });
  Object.defineProperty(User, 'exists', { configurable: true, value: async () => true });
  Object.defineProperty(Appointment, 'findOne', {
    configurable: true,
    value: async () => ({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }),
  });
  Object.defineProperty(Appointment, 'create', {
    configurable: true,
    value: async () => {
      createCalled = true;
      return {};
    },
  });
  try {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const response = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        Cookie: `token=${makeToken(undefined, 'PATIENT', 'patient')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doctorId: 'cccccccccccccccccccccccc',
        departmentId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        hospitalId: HOSPITAL_ID,
        appointmentDate: date,
        appointmentTime: '10:00',
        reason: 'Routine appointment',
      }),
    });
    assert.equal(response.status, 409);
    assert.equal(createCalled, false);
  } finally {
    Object.defineProperty(User, 'findById', { configurable: true, value: originalFindById });
    Object.defineProperty(User, 'exists', { configurable: true, value: originalUserExists });
    Object.defineProperty(Patient, 'findOne', { configurable: true, value: originalPatientFindOne });
    Object.defineProperty(Doctor, 'findOne', { configurable: true, value: originalDoctorFindOne });
    Object.defineProperty(Appointment, 'findOne', { configurable: true, value: originalAppointmentFindOne });
    Object.defineProperty(Appointment, 'create', { configurable: true, value: originalAppointmentCreate });
  }
});

test('appointment priority failure falls back to routine with manual review required', () => {
  const fallback = assessPriorityForBooking(
    { reason: 'Routine appointment', symptoms: [] },
    () => {
      throw new Error('AI service unavailable');
    }
  );
  assert.deepEqual(fallback, { priority: 'ROUTINE', requiresHumanReview: true });
});
