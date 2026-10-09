'use client';
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form';
import { hospitalApi } from '@/services/api';
import type { Hospital } from '@/types';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});
type FormData = z.infer<typeof schema>;

const ROLE_REDIRECTS: Record<string, string> = {
  OWNER: '/admin/dashboard',
  ADMIN: '/admin/dashboard',
  DOCTOR: '/doctor/dashboard',
  STAFF: '/staff/dashboard',
};

function StaffLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, user, loading } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const hospital = hospitals.find((item) => item._id === selectedHospitalId) ?? null;

  const redirect = params.get('redirect') ?? '';
  const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('\\')
    ? redirect
    : '';

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Fetch public hospital identities for tenant-aware staff sign-in.
  useEffect(() => {
    hospitalApi.getHospitals()
      .then((r) => {
        const availableHospitals = (r.data.hospitals ?? []) as Hospital[];
        setHospitals(availableHospitals);
        if (availableHospitals.length === 1) {
          setSelectedHospitalId(availableHospitals[0]._id);
        }
      })
      .catch(() => setError('Could not load hospital information. Please refresh and try again.'));
  }, []);

  // Redirect already-authenticated staff
  useEffect(() => {
    if (!loading && user) {
      const dest = ROLE_REDIRECTS[user.role];
      if (dest) {
        router.push(safeRedirect || dest);
      } else {
        // Patient accidentally on staff login
        router.push('/login');
      }
    }
  }, [user, loading, router, safeRedirect]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError('');
    try {
      const loggedInUser = await login(data.email, data.password, false, 'staff', hospital?._id);
      const dest = ROLE_REDIRECTS[loggedInUser.role];
      if (!dest) {
        // Patient account — show generic error, never reveal the reason
        setError('Invalid credentials');
        setIsLoading(false);
        return;
      }
      // mustChangePassword → redirect to change-password page
      if (loggedInUser.mustChangePassword) {
        router.push('/change-password');
        return;
      }
      router.push(safeRedirect || dest);
    } catch {
      setError('Invalid credentials');
      setIsLoading(false);
    }
  };

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
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-white">{siteName[0]}</span>
            </div>
          )}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{siteName}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Staff Portal</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff sign in</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              For doctors, nurses, administrators and owners only
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
           <div>
             <Label htmlFor="hospitalId">Hospital</Label>
             <select
               id="hospitalId"
               value={selectedHospitalId}
               onChange={(event) => {
                 setSelectedHospitalId(event.target.value);
                 setError('');
               }}
               required
               className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
             >
               <option value="" disabled>Select your hospital</option>
               {hospitals.map((item) => (
                 <option key={item._id} value={item._id}>{item.name}</option>
               ))}
             </select>
           </div>
            <div>
              <Label htmlFor="email">Work email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@hospital.org"
                className="mt-1"
                autoComplete="username"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={isLoading}>
              Sign In <ArrowRight size={16} className="ml-1" />
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-6">
            Team accounts are managed by your hospital owner.
            <br />New hospitals can register an owner account below.
          </p>

          <div className="mt-5 border-t border-gray-100 pt-5 dark:border-slate-800">
            <Link
              href="/login"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950"
            >
              Patient Portal
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/register-hospital"
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Register your hospital
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    }>
      <StaffLoginInner />
    </Suspense>
  );
}
