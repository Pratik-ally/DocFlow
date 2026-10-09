'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import axios from 'axios';
import {
  hospitalDetailsSchema,
  hospitalRegistrationSchema,
  ownerDetailsSchema,
  type HospitalRegistrationInput,
} from '@shared/hospitalRegistration';
import { hospitalRegistrationApi, getApiErrorMessage } from '@/services/api';

const initialValues: HospitalRegistrationInput = {
  hospitalName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  ownerName: '',
  mobile: '',
  email: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false,
};

const hospitalFields = ['hospitalName', 'addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode'] as const;
const ownerFields = ['ownerName', 'mobile', 'email', 'password', 'confirmPassword'] as const;

export default function RegisterHospitalPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [values, setValues] = useState<HospitalRegistrationInput>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [requestError, setRequestError] = useState('');
  const [busy, setBusy] = useState(false);
  const progress = useMemo(() => Math.min(step, 3), [step]);

  function updateField<K extends keyof HospitalRegistrationInput>(field: K, value: HospitalRegistrationInput[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setRequestError('');
  }

  function collectErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
    const next: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.path[0]?.toString();
      if (key && !next[key]) next[key] = issue.message;
    }
    setErrors(next);
  }

  function continueToOwner() {
    const result = hospitalDetailsSchema.safeParse({
      hospitalName: values.hospitalName,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      city: values.city,
      state: values.state,
      country: values.country,
      postalCode: values.postalCode,
    });
    if (!result.success) {
      collectErrors(result.error.issues);
      return;
    }
    setErrors({});
    setStep(2);
  }

  function continueToReview() {
    const result = ownerDetailsSchema.safeParse({
      ownerName: values.ownerName,
      mobile: values.mobile,
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });
    if (!result.success) {
      collectErrors(result.error.issues);
      return;
    }
    setErrors({});
    setStep(3);
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = hospitalRegistrationSchema.safeParse(values);
    if (!parsed.success) {
      collectErrors(parsed.error.issues);
      setStep(parsed.error.issues.some((issue) => hospitalFields.includes(issue.path[0] as typeof hospitalFields[number]))
        ? 1
        : parsed.error.issues.some((issue) => ownerFields.includes(issue.path[0] as typeof ownerFields[number])) ? 2 : 3);
      return;
    }

    setBusy(true);
    setRequestError('');
    try {
      const response = await hospitalRegistrationApi.register(parsed.data);
      setNotice(response.data.message);
      setStep(4);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 503) {
        setNotice('If your registration was recorded, request a new code below.');
        setStep(4);
      }
      setRequestError(getApiErrorMessage(error, 'Unable to complete registration.'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: 'Enter the 6-digit code sent to your email.' });
      return;
    }
    setBusy(true);
    setErrors({});
    setRequestError('');
    try {
      const response = await hospitalRegistrationApi.verifyEmail({ email: values.email, code });
      const result = await signIn('staff-credentials', {
        email: values.email,
        password: values.password,
        hospitalId: response.data.hospitalId as string,
        redirect: false,
      });
      if (!result || result.error) {
        setRequestError('Email verified. Sign in from the staff portal to continue.');
        return;
      }
      const bridge = await fetch('/api/auth/session-bridge', { method: 'POST', credentials: 'include' });
      if (!bridge.ok) {
        setRequestError('Email verified. Sign in from the staff portal to continue.');
        return;
      }
      router.replace('/admin/dashboard');
      router.refresh();
    } catch (error: unknown) {
      setRequestError(getApiErrorMessage(error, 'Unable to verify email.'));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    setRequestError('');
    try {
      const response = await hospitalRegistrationApi.resendCode(values.email);
      setNotice(response.data.message);
    } catch (error: unknown) {
      setRequestError(getApiErrorMessage(error, 'Unable to request a new code.'));
    } finally {
      setBusy(false);
    }
  }

  function field(
    name: keyof HospitalRegistrationInput,
    label: string,
    props: { type?: string; autoComplete?: string; placeholder?: string; inputMode?: 'text' | 'email' | 'tel' | 'numeric' } = {}
  ) {
    const id = `registration-${name}`;
    const errorId = `${id}-error`;
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</label>
        <input
          id={id}
          name={name}
          type={props.type ?? 'text'}
          autoComplete={props.autoComplete}
          inputMode={props.inputMode}
          placeholder={props.placeholder}
          value={(values[name] ?? '') as string}
          onChange={(event) => updateField(name, event.target.value as HospitalRegistrationInput[typeof name])}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? errorId : undefined}
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 aria-[invalid=true]:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-indigo-950"
        />
        {errors[name] && <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">{errors[name]}</p>}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 text-center">
          <Link href="/staff-login" className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">DocFlow</Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Register your hospital</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Set up your hospital workspace and owner account.</p>
        </header>

        <section aria-label="Registration progress" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Step {progress} of 3</span><span>{progress === 1 ? 'Hospital' : progress === 2 ? 'Owner' : 'Review and confirm'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(progress / 3) * 100}%` }} />
          </div>
          <ol className="mt-3 grid grid-cols-3 text-xs text-slate-500 dark:text-slate-400">
            <li aria-current={progress === 1 ? 'step' : undefined}>Hospital</li>
            <li className="text-center" aria-current={progress === 2 ? 'step' : undefined}>Owner</li>
            <li className="text-right" aria-current={progress === 3 ? 'step' : undefined}>Review</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          {requestError && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{requestError}</p>}

          {step === 1 && (
            <div className="space-y-5">
              <div><h2 className="text-xl font-semibold text-slate-950 dark:text-white">Hospital details</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Enter the registered name and location of your hospital.</p></div>
              {field('hospitalName', 'Hospital name', { autoComplete: 'organization' })}
              {field('addressLine1', 'Address line 1', { autoComplete: 'address-line1' })}
              {field('addressLine2', 'Address line 2 (optional)', { autoComplete: 'address-line2' })}
              <div className="grid gap-5 sm:grid-cols-2">
                {field('city', 'City', { autoComplete: 'address-level2' })}
                {field('state', 'State or province', { autoComplete: 'address-level1' })}
                {field('country', 'Country', { autoComplete: 'country-name' })}
                {field('postalCode', 'Postal code', { autoComplete: 'postal-code' })}
              </div>
              <button type="button" onClick={continueToOwner} className="h-11 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Continue to owner details</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div><h2 className="text-xl font-semibold text-slate-950 dark:text-white">Owner account</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">The owner will manage this hospital workspace.</p></div>
              {field('ownerName', 'Owner full name', { autoComplete: 'name' })}
              {field('mobile', 'Mobile number with country code', { type: 'tel', autoComplete: 'tel', placeholder: '+14155552671', inputMode: 'tel' })}
              <p className="-mt-4 text-xs text-slate-500 dark:text-slate-400">Use international format, for example +14155552671.</p>
              {field('email', 'Email address', { type: 'email', autoComplete: 'email' })}
              {field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
              <p className="-mt-4 text-xs text-slate-500 dark:text-slate-400">At least 10 characters, with uppercase and lowercase letters, a number, and a symbol.</p>
              {field('confirmPassword', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setErrors({}); setStep(1); }} className="h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Back</button>
                <button type="button" onClick={continueToReview} className="h-11 flex-1 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">Review details</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={submitRegistration} className="space-y-5">
              <div><h2 className="text-xl font-semibold text-slate-950 dark:text-white">Review and confirm</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Check the details before creating the owner account.</p></div>
              <dl className="grid gap-x-8 gap-y-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 dark:bg-slate-950">
                {[
                  ['Hospital', values.hospitalName],
                  ['Address', [values.addressLine1, values.addressLine2, values.city, values.state, values.postalCode, values.country].filter(Boolean).join(', ')],
                  ['Owner', values.ownerName],
                  ['Mobile', values.mobile],
                  ['Email', values.email],
                  ['Password', '••••••••••'],
                ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-900 dark:text-slate-100">{value}</dd></div>)}
              </dl>
              <div>
                <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={values.termsAccepted}
                    onChange={(event) => updateField('termsAccepted', event.target.checked)}
                    aria-invalid={Boolean(errors.termsAccepted)}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  I accept the terms and privacy notice.
                </label>
                {errors.termsAccepted && <p role="alert" className="mt-1 text-sm text-red-600">{errors.termsAccepted}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setErrors({}); setStep(2); }} className="h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Back</button>
                <button type="submit" disabled={busy} className="h-11 flex-1 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Submitting…' : 'Create owner account'}</button>
              </div>
            </form>
          )}

          {step === 4 && (
            <form onSubmit={verifyEmail} className="space-y-5">
              <div><h2 className="text-xl font-semibold text-slate-950 dark:text-white">Verify your email</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{notice} Enter the 6-digit code below. It expires in 10 minutes.</p></div>
              <div>
                <label htmlFor="verification-code" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-100">Email verification code</label>
                <input
                  id="verification-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrors({}); }}
                  aria-invalid={Boolean(errors.code)}
                  aria-describedby={errors.code ? 'verification-code-error' : undefined}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-center text-lg tracking-[0.4em] text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                {errors.code && <p id="verification-code-error" role="alert" className="mt-1 text-sm text-red-600">{errors.code}</p>}
              </div>
              <button type="submit" disabled={busy} className="h-11 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Verifying…' : 'Verify email and continue'}</button>
              <button type="button" onClick={() => { void resendCode(); }} disabled={busy} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Resend code</button>
            </form>
          )}
        </section>
        <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an owner account? <Link href="/staff-login" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">Staff sign in</Link>
        </p>
      </div>
    </main>
  );
}
