'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DocFlowLogo } from '@/components/ui/DocFlowLogo';

const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  OAuthSignin: {
    title: 'Google Sign-In Failed',
    message: 'We could not start the Google sign-in process. Please try again.',
  },
  OAuthCallback: {
    title: 'Authentication Failed',
    message: 'There was a problem completing the Google authentication. Please try again.',
  },
  OAuthCreateAccount: {
    title: 'Account Creation Failed',
    message: 'We could not create your account from Google. Please try again or register with email.',
  },
  OAuthAccountNotLinked: {
    title: 'Account Already Exists',
    message: 'An account with this email already exists. Please sign in with your email and password instead.',
  },
  CredentialsSignin: {
    title: 'Invalid Credentials',
    message: 'The email or password you entered is incorrect. Please try again.',
  },
  SessionRequired: {
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again.',
  },
  Default: {
    title: 'Authentication Error',
    message: 'An unexpected error occurred during sign-in. Please try again.',
  },
};

function ErrorContent() {
  const params = useSearchParams();
  const errorCode = params.get('error') ?? 'Default';
  const { title, message } = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <Link href="/"><DocFlowLogo size={28} /></Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="text-red-600 dark:text-red-400" size={28} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-6">{message}</p>

          {errorCode === 'OAuthAccountNotLinked' && (
            <div className="mb-5 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-700 dark:text-amber-400 text-left">
              Your email is registered with a password. Use <strong>Continue with Email</strong> to sign in, then you can link Google later.
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="w-full flex items-center justify-center h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors"
            >
              Back to Sign In
            </Link>
            <Link
              href="/"
              className="w-full flex items-center justify-center h-10 px-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-700 dark:text-slate-300 transition-colors"
            >
              Go to Home
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <p className="mt-4 text-xs text-gray-400 dark:text-slate-500 font-mono">Error code: {errorCode}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
