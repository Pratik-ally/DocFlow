import { z } from 'zod';

const commonPasswords = new Set([
  'password',
  'password123',
  'password1',
  'password1234',
  'qwerty',
  'qwerty123',
  'qwerty12345',
  'letmein',
  'letmein123',
  'welcome',
  'welcome123',
  'admin',
  'admin12345',
  'iloveyou',
  'iloveyou123',
  'changeme',
  'changeme123',
  'abc123456',
  '1234567890',
  'monkey',
  'dragon',
  'sunshine',
]);

const normalizedMobileSchema = z.string()
  .trim()
  .max(40, 'Enter a valid mobile number with country code (E.164).')
  .transform((value) => value.replace(/[\s().-]/g, ''))
  .refine((value) => /^\+[1-9]\d{7,14}$/.test(value), 'Enter a valid mobile number with country code (E.164).');

export const hospitalDetailsSchema = z.object({
  hospitalName: z.string().trim().min(2, 'Hospital name must be at least 2 characters.').max(120, 'Hospital name must be 120 characters or fewer.'),
  addressLine1: z.string().trim().min(1, 'Address line 1 is required.').max(160),
  addressLine2: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().min(1, 'City is required.').max(100),
  state: z.string().trim().min(1, 'State or province is required.').max(100),
  country: z.string().trim().min(1, 'Country is required.').max(100),
  postalCode: z.string().trim().min(1, 'Postal code is required.').max(24),
});

export const ownerDetailsSchema = z.object({
  ownerName: z.string()
    .trim()
    .min(2, 'Owner name must be at least 2 characters.')
    .max(80, 'Owner name must be 80 characters or fewer.')
    .regex(/^[\p{L} .-]+$/u, 'Use letters, spaces, periods, and hyphens only.'),
  mobile: normalizedMobileSchema,
  email: z.string().trim().email('Enter a valid email address.').max(254).transform((value) => value.toLowerCase()),
  password: z.string()
    .min(10, 'Password must be at least 10 characters.')
    .max(72, 'Password must be 72 characters or fewer.')
    .regex(/[A-Z]/, 'Include at least one uppercase letter.')
    .regex(/[a-z]/, 'Include at least one lowercase letter.')
    .regex(/[0-9]/, 'Include at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.')
    .refine(
      (value) => !commonPasswords.has(value.toLowerCase().replace(/[^a-z0-9]/g, '')),
      'Choose a less common password.'
    ),
  confirmPassword: z.string().min(1, 'Confirm your password.'),
});

export const hospitalRegistrationSchema = hospitalDetailsSchema
  .merge(ownerDetailsSchema)
  .extend({
    termsAccepted: z.boolean().refine((accepted) => accepted, 'Accept the terms and privacy notice to continue.'),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export const verifyHospitalEmailSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export const resendHospitalCodeSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export type HospitalRegistrationInput = z.input<typeof hospitalRegistrationSchema>;
export type ValidHospitalRegistration = z.output<typeof hospitalRegistrationSchema>;
