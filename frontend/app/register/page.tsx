'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { authApi } from '@/services/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/form';
import { ThemeToggleDropdown } from '@/components/ui/ThemeToggle';
import { DocFlowLogo } from '@/components/ui/DocFlowLogo';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  dateOfBirth: z.string().min(1, 'Date of birth required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { required_error: 'Gender required' }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const password = watch('password', '');

  const passwordRules = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError('');
    try {
      await authApi.register({
        name: data.name,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        password: data.password,
      });
      await login(data.email, data.password);
      setSuccess(true);
      setTimeout(() => router.push('/patient/dashboard'), 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Registration failed');
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600 dark:text-green-400" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Created!</h2>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-blue-600 to-teal-600 flex-col justify-between p-12">
        <Link href="/"><DocFlowLogo size={32} variant="white" textSize="text-lg" /></Link>
        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">Join as a patient today.</h2>
          <p className="text-blue-100">Book appointments, track your queue position, and manage your healthcare journey.</p>
          <ul className="mt-6 space-y-2">
            {['AI-assisted priority assessment', 'Real-time queue updates', 'Appointment history', 'Secure health data storage'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-blue-100 text-sm">
                <CheckCircle size={14} className="text-teal-300 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-white/60 text-xs">© {new Date().getFullYear()} DocFlow · Demo Platform</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile logo + theme toggle */}
          <div className="flex lg:hidden items-center justify-between mb-8">
            <Link href="/"><DocFlowLogo size={28} /></Link>
            <ThemeToggleDropdown />
          </div>
          {/* Desktop theme toggle */}
          <div className="hidden lg:flex justify-end mb-4">
            <ThemeToggleDropdown />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create patient account</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">All fields are required</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" placeholder="Aarav Sharma" className="mt-1" {...register('name')} />
                {errors.name && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" className="mt-1" {...register('email')} />
                  {errors.email && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+91-9800000000" className="mt-1" {...register('phone')} />
                  {errors.phone && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dateOfBirth">Date of birth</Label>
                  <Input id="dateOfBirth" type="date" className="mt-1" {...register('dateOfBirth')} />
                  {errors.dateOfBirth && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.dateOfBirth.message}</p>}
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    id="gender"
                    className="mt-1"
                    placeholder="Select gender"
                    options={[
                      { value: 'MALE', label: 'Male' },
                      { value: 'FEMALE', label: 'Female' },
                      { value: 'OTHER', label: 'Other' },
                    ]}
                    {...register('gender')}
                  />
                  {errors.gender && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.gender.message}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Input id="password" type={showPw ? 'text' : 'password'} placeholder="••••••••" {...register('password')} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {passwordRules.map((r) => (
                      <div key={r.label} className={`flex items-center gap-1 text-xs ${r.met ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500'}`}>
                        <CheckCircle size={10} className={r.met ? 'text-green-500 dark:text-green-400' : 'text-gray-300 dark:text-slate-600'} />
                        {r.label}
                      </div>
                    ))}
                  </div>
                )}
                {errors.password && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" className="mt-1" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <Button type="submit" className="w-full" loading={isLoading}>
                Create Account <ArrowRight size={16} className="ml-1" />
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-5">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 dark:text-sky-400 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
