import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHmac } from 'node:crypto';
import { createServer, Server } from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { Hospital } from '../models/Hospital';
import { HospitalEmailVerification } from '../models/HospitalEmailVerification';
import { User } from '../models/User';
import { config } from '../config';
import { hospitalRegistrationEmailService } from '../services/hospitalRegistrationEmail';
import authRoutes from '../routes/auth';
import hospitalRoutes from '../routes/hospital';
import { hospitalRegistrationSchema } from '../validation/hospitalRegistration';

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api/auth', authRoutes);
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

function registrationBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    hospitalName: 'Northside Medical Centre',
    addressLine1: '12 Care Avenue',
    addressLine2: '',
    city: 'Springfield',
    state: 'Illinois',
    country: 'United States',
    postalCode: '62701',
    ownerName: 'Jordan Smith',
    mobile: '+1 (415) 555-2671',
    email: 'OWNER@EXAMPLE.TEST',
    password: 'SecureOwner#482',
    confirmPassword: 'SecureOwner#482',
    termsAccepted: true,
    ...overrides,
  };
}

interface SavedMethod {
  target: object;
  property: string;
  descriptor?: PropertyDescriptor;
}

function replaceMethod(target: object, property: string, value: unknown, saved: SavedMethod[]): void {
  saved.push({ target, property, descriptor: Object.getOwnPropertyDescriptor(target, property) });
  Object.defineProperty(target, property, { configurable: true, value });
}

function restoreMethods(saved: SavedMethod[]): void {
  for (const method of saved.reverse()) {
    if (method.descriptor) Object.defineProperty(method.target, method.property, method.descriptor);
    else Reflect.deleteProperty(method.target, method.property);
  }
}

interface StoredRegistration {
  hospitals: Array<Record<string, unknown>>;
  owners: Array<Record<string, unknown>>;
  verifications: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
}

function mockRegistrationModels(options: { failOwnerCreate?: boolean; failEmail?: boolean; duplicate?: 'email' | 'mobile' } = {}) {
  const saved: SavedMethod[] = [];
  const committed: StoredRegistration = { hospitals: [], owners: [], verifications: [], audits: [] };
  let staged: StoredRegistration = { hospitals: [], owners: [], verifications: [], audits: [] };
  let nextHospitalId = new mongoose.Types.ObjectId();
  let nextOwnerId = new mongoose.Types.ObjectId();
  let code: string | undefined;
  const fakeSession = {
    active: false,
    inTransaction() { return this.active; },
    async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
      this.active = true;
      staged = { hospitals: [], owners: [], verifications: [], audits: [] };
      try {
        const value = await operation();
        Object.assign(committed, staged);
        this.active = false;
        return value;
      } catch (error) {
        staged = { hospitals: [], owners: [], verifications: [], audits: [] };
        this.active = false;
        throw error;
      }
    },
    async abortTransaction() { staged = { hospitals: [], owners: [], verifications: [], audits: [] }; this.active = false; },
    async endSession() {},
  };

  replaceMethod(mongoose, 'startSession', async () => fakeSession, saved);
  replaceMethod(User, 'exists', async (filter: Record<string, unknown>) => {
    if (options.duplicate === 'email' && filter.email) return { _id: new mongoose.Types.ObjectId() };
    if (options.duplicate === 'mobile' && filter.$or) return { _id: new mongoose.Types.ObjectId() };
    return null;
  }, saved);
  replaceMethod(Hospital, 'create', async (documents: Array<Record<string, unknown>>) => {
    const hospital = { ...documents[0], _id: nextHospitalId };
    staged.hospitals.push(hospital);
    return [hospital];
  }, saved);
  replaceMethod(User, 'create', async (documents: Array<Record<string, unknown>>) => {
    if (options.failOwnerCreate) throw new Error('simulated owner insert failure');
    const owner = { ...documents[0], _id: nextOwnerId, createdAt: new Date() };
    staged.owners.push(owner);
    return [owner];
  }, saved);
  replaceMethod(Hospital, 'updateOne', async (_filter: unknown, update: { $set: Record<string, unknown> }) => {
    const hospital = staged.hospitals[0];
    if (hospital) Object.assign(hospital, update.$set);
    return { modifiedCount: 1 };
  }, saved);
  replaceMethod(HospitalEmailVerification, 'create', async (documents: Array<Record<string, unknown>>) => {
    staged.verifications.push(documents[0]);
    return documents;
  }, saved);
  replaceMethod(AuditLog, 'create', async (documents: Array<Record<string, unknown>>) => {
    staged.audits.push(documents[0]);
    return documents;
  }, saved);
  replaceMethod(hospitalRegistrationEmailService, 'sendVerificationCode', async (_email: string, value: string) => {
    if (options.failEmail) throw new Error('simulated email delivery failure');
    code = value;
  }, saved);

  return {
    committed,
    getCode: () => code,
    setIds: (hospitalId: mongoose.Types.ObjectId, ownerId: mongoose.Types.ObjectId) => {
      nextHospitalId = hospitalId;
      nextOwnerId = ownerId;
    },
    restore: () => restoreMethods(saved),
  };
}

async function postJson(path: string, body: Record<string, unknown>, ip = '198.51.100.10') {
  return fetch(`${baseUrl}/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': ip,
    },
    body: JSON.stringify(body),
  });
}

test('valid registration creates one linked PENDING hospital and OWNER; client role and hospitalId are ignored', async () => {
  const mocks = mockRegistrationModels();
  try {
    const response = await postJson('/hospitals/register', registrationBody({
      role: 'ADMIN',
      hospitalId: new mongoose.Types.ObjectId().toString(),
    }));
    assert.equal(response.status, 201);
    assert.equal(mocks.committed.hospitals.length, 1);
    assert.equal(mocks.committed.owners.length, 1);
    const hospital = mocks.committed.hospitals[0];
    const owner = mocks.committed.owners[0];
    assert.equal(owner.role, 'OWNER');
    assert.equal(owner.status, 'PENDING_VERIFICATION');
    assert.equal(owner.email, 'owner@example.test');
    assert.equal(owner.mobile, '+14155552671');
    assert.equal(owner.hospitalId, hospital._id);
    assert.equal(hospital.ownerId, owner._id);
    assert.equal(hospital.status, 'PENDING');
    assert.equal(mocks.committed.verifications.length, 1);
    assert.equal(mocks.committed.audits.length, 1);
    assert.equal('password' in mocks.committed.audits[0], false);
    assert.equal('code' in mocks.committed.verifications[0], false);
    assert.match(mocks.getCode() ?? '', /^\d{6}$/);
  } finally {
    mocks.restore();
  }
});

test('owner creation failure aborts the transaction without partial hospital data', async () => {
  const mocks = mockRegistrationModels({ failOwnerCreate: true });
  try {
    const response = await postJson('/hospitals/register', registrationBody(), '198.51.100.11');
    assert.equal(response.status, 500);
    assert.deepEqual(mocks.committed, { hospitals: [], owners: [], verifications: [], audits: [] });
  } finally {
    mocks.restore();
  }
});

test('email delivery failure is reported explicitly after registration commits', async () => {
  const mocks = mockRegistrationModels({ failEmail: true });
  try {
    const response = await postJson('/hospitals/register', registrationBody(), '198.51.100.14');
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false, message: 'Unable to complete registration' });
    assert.equal(mocks.committed.hospitals.length, 1);
    assert.equal(mocks.committed.owners.length, 1);
  } finally {
    mocks.restore();
  }
});

for (const duplicate of ['email', 'mobile'] as const) {
  test(`duplicate ${duplicate} is rejected with the same generic response`, async () => {
    const mocks = mockRegistrationModels({ duplicate });
    try {
      const response = await postJson('/hospitals/register', registrationBody(), duplicate === 'email' ? '198.51.100.12' : '198.51.100.13');
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { success: false, message: 'Unable to complete registration' });
      assert.equal(mocks.committed.hospitals.length, 0);
    } finally {
      mocks.restore();
    }
  });
}

test('the shared frontend/backend schema and endpoint reject invalid mobile, weak password and missing fields', async () => {
  const invalidInputs = [
    registrationBody({ mobile: '555-12' }),
    registrationBody({ password: 'simplepassword', confirmPassword: 'simplepassword' }),
    {},
  ];
  for (const input of invalidInputs) {
    assert.equal(hospitalRegistrationSchema.safeParse(input).success, false);
    const response = await postJson('/hospitals/register', input, `198.51.100.${20 + invalidInputs.indexOf(input)}`);
    assert.equal(response.status, 400);
  }
});

test('wrong and expired codes fail; five wrong attempts exhaust the code and block the sixth', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const hospitalId = new mongoose.Types.ObjectId();
  const verificationId = new mongoose.Types.ObjectId();
  const email = 'owner@example.test';
  const validCode = '482913';
  const codeHash = createHmac('sha256', config.jwtSecret).update(`${email}:${validCode}`).digest('hex');
  const fixture = {
    _id: verificationId,
    ownerId,
    hospitalId,
    codeHash,
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
  };
  const saved: SavedMethod[] = [];
  let ownerFindCount = 0;
  let committedOwnerUpdates = 0;
  replaceMethod(User, 'findOne', () => ({ select: async () => {
    ownerFindCount += 1;
    return { _id: ownerId, hospitalId, createdAt: new Date() };
  } }), saved);
  replaceMethod(HospitalEmailVerification, 'findOne', () => ({ select: async () => fixture }), saved);
  replaceMethod(HospitalEmailVerification, 'updateOne', async (filter: { attempts: number }, update: { $inc?: { attempts: number } }) => {
    if (filter.attempts !== fixture.attempts) return { modifiedCount: 0 };
    fixture.attempts += update.$inc?.attempts ?? 0;
    return { modifiedCount: 1 };
  }, saved);
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postJson('/hospitals/verify-email', { email, code: '000000' }, `198.51.100.${30 + attempt}`);
      assert.equal(response.status, 400);
    }
    const sixth = await postJson('/hospitals/verify-email', { email, code: validCode }, '198.51.100.35');
    assert.equal(sixth.status, 400);
    assert.equal(fixture.attempts, 5);
    assert.equal(committedOwnerUpdates, 0);

    fixture.attempts = 0;
    fixture.expiresAt = new Date(Date.now() - 1);
    const expired = await postJson('/hospitals/verify-email', { email, code: validCode }, '198.51.100.36');
    assert.equal(expired.status, 400);
    assert.equal(ownerFindCount, 7);
    assert.equal(committedOwnerUpdates, 0);
  } finally {
    restoreMethods(saved);
  }
});

test('a valid code activates the owner and hospital once; a reused code is rejected', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const hospitalId = new mongoose.Types.ObjectId();
  const verificationId = new mongoose.Types.ObjectId();
  const email = 'owner@example.test';
  const validCode = '482913';
  const fixture = {
    _id: verificationId,
    ownerId,
    hospitalId,
    codeHash: createHmac('sha256', config.jwtSecret).update(`${email}:${validCode}`).digest('hex'),
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
  };
  const saved: SavedMethod[] = [];
  let codeDeleted = false;
  let ownerActivated = false;
  let hospitalActivated = false;
  let auditCreated = false;
  const fakeSession = {
    active: false,
    inTransaction() { return this.active; },
    async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
      this.active = true;
      const result = await operation();
      this.active = false;
      return result;
    },
    async abortTransaction() { this.active = false; },
    async endSession() {},
  };
  replaceMethod(mongoose, 'startSession', async () => fakeSession, saved);
  replaceMethod(User, 'findOne', () => ({ select: async () => ({
    _id: ownerId,
    hospitalId,
    createdAt: new Date(),
  }) }), saved);
  replaceMethod(HospitalEmailVerification, 'findOne', () => ({ select: async () => codeDeleted ? null : fixture }), saved);
  replaceMethod(HospitalEmailVerification, 'updateOne', async (_filter: unknown, update: { $inc?: { attempts: number } }) => {
    fixture.attempts += update.$inc?.attempts ?? 0;
    return { modifiedCount: 1 };
  }, saved);
  replaceMethod(User, 'updateOne', async (_filter: unknown, update: { $set: { status: string } }) => {
    ownerActivated = update.$set.status === 'ACTIVE';
    return { modifiedCount: 1 };
  }, saved);
  replaceMethod(Hospital, 'updateOne', async (_filter: unknown, update: { $set: { status: string } }) => {
    hospitalActivated = update.$set.status === 'ACTIVE';
    return { modifiedCount: 1 };
  }, saved);
  replaceMethod(HospitalEmailVerification, 'deleteOne', async () => {
    codeDeleted = true;
    return { deletedCount: 1 };
  }, saved);
  replaceMethod(AuditLog, 'create', async () => { auditCreated = true; return []; }, saved);
  try {
    const response = await postJson('/hospitals/verify-email', { email, code: validCode }, '198.51.100.37');
    assert.equal(response.status, 200);
    assert.equal(ownerActivated, true);
    assert.equal(hospitalActivated, true);
    assert.equal(auditCreated, true);
    const reused = await postJson('/hospitals/verify-email', { email, code: validCode }, '198.51.100.38');
    assert.equal(reused.status, 400);
  } finally {
    restoreMethods(saved);
  }
});

test('an unverified owner cannot sign in through the staff login endpoint', async () => {
  const saved: SavedMethod[] = [];
  replaceMethod(User, 'find', () => ({
    limit: async () => [{
      _id: new mongoose.Types.ObjectId(),
      email: 'owner@example.test',
      role: 'OWNER',
      status: 'PENDING_VERIFICATION',
      passwordHash: '$2a$12$not-compared',
    }],
  }), saved);
  try {
    const response = await postJson('/auth/staff-login', {
      email: 'owner@example.test',
      password: 'SecureOwner#482',
    }, '198.51.100.40');
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { success: false, message: 'Invalid credentials' });
  } finally {
    restoreMethods(saved);
  }
});

test('the fourth hospital registration from one IP in an hour is rate limited', async () => {
  const ip = '198.51.100.50';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await postJson('/hospitals/register', {}, ip);
    assert.equal(response.status, 400);
  }
  const fourth = await postJson('/hospitals/register', {}, ip);
  assert.equal(fourth.status, 429);
  assert.deepEqual(await fourth.json(), { success: false, message: 'Unable to complete registration' });
});
