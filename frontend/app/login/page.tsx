'use client';
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form';
import { authApi } from '@/services/api';
import type { Hospital } from '@/types';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});
type FormData = z.infer<typeof schema>;

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type LoginView = 'choose' | 'email';

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, user, loading } = useAuth();
  const [view, setView] = useState<LoginView>('choose');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [hospital, setHospital] = useState<Hospital | null>(null);

  const redirect = params.get('redirect') ?? '';
  const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('\\')
    ? redirect
    : '';
  const callbackError = params.get('error');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Fetch hospital name/logo for display
  useEffect(() => {
    authApi.getHospitalPublic()
      .then((r) => { if (r.data.hospital) setHospital(r.data.hospital as Hospital); })
      .catch(() => {});
  }, []);

  // If already authenticated as PATIENT, redirect
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'PATIENT') {
        router.push(safeRedirect || '/patient/dashboard');
      } else {
        // Staff accidentally on patient login → send to staff login
        router.push('/staff-login');
      }
    }
  }, [user, loading, router, safeRedirect]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signIn('google', {
        callbackUrl: safeRedirect || '/patient/dashboard',
      });
    } catch {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError('');
    try {
      const loggedInUser = await login(data.email, data.password, false, 'patient');
      if (loggedInUser.role !== 'PATIENT') {
        setError('Invalid credentials');
        setIsLoading(false);
        return;
      }
      router.push(safeRedirect || '/patient/dashboard');
    } catch {
      setError('Invalid credentials');
      setIsLoading(false);
    }
  };

  const authErrorMessages: Record<string, string> = {
    OAuthSignin: 'Could not start Google sign-in. Please try again.',
    OAuthCallback: 'Google authentication failed. Please try again.',
    OAuthCreateAccount: 'Could not create account from Google. Please try again.',
    OAuthAccountNotLinked: 'This email is already registered with a password. Please sign in with email.',
    CredentialsSignin: 'Invalid credentials.',
    Default: 'Authentication error. Please try again.',
  };

  const displayError = error || (callbackError ? authErrorMessages[callbackError] ?? authErrorMessages.Default : '');

  const siteName = 'DocFlow';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Hospital branding */}
        <div className="text-center mb-8">
          {hospital?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hospital.logoUrl} alt={siteName} className="h-14 mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-white">{siteName[0]}</span>
            </div>
          )}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{siteName}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Patient Portal</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
          {view === 'choose' && (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Sign in to your patient account</p>
              </div>

              {displayError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {displayError}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-300 transition-all disabled:opacity-60 shadow-sm"
              >
                {googleLoading ? (
                  <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <GoogleIcon size={20} />
                )}
                {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800" />
                <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800" />
              </div>

              <button
                type="button"
                onClick={() => setView('email')}
                className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors shadow-sm"
              >
                Continue with Email
                <ArrowRight size={15} />
              </button>

              <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-5">
                New patient?{' '}
                <Link href="/register" className="text-blue-600 dark:text-sky-400 font-medium hover:underline">Create account</Link>
              </p>
            </>
          )}

          {view === 'email' && (
            <>
              <div className="flex items-center gap-3 mb-7">
                <button
                  type="button"
                  onClick={() => { setView('choose'); setError(''); }}
                  className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                  aria-label="Back"
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in with email</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Patient accounts only</p>
                </div>
              </div>

              {displayError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" placeholder="you@example.com" className="mt-1" {...register('email')} />
                  {errors.email && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1">
                    <Input id="password" type={showPw ? 'text' : 'password'} placeholder="••••••••" {...register('password')} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full" loading={isLoading}>
                  Sign In <ArrowRight size={16} className="ml-1" />
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-5">
                New patient?{' '}
                <Link href="/register" className="text-blue-600 dark:text-sky-400 font-medium hover:underline">Create account</Link>
              </p>
            </>
          )}

          <div className="mt-5 border-t border-gray-100 pt-5 dark:border-slate-800">
            <Link
              href="/staff-login"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950"
            >
              Staff Portal
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
