import Link from 'next/link';
import { Lock } from 'lucide-react';
import { DocFlowLogo } from '@/components/ui/DocFlowLogo';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <Link href="/"><DocFlowLogo size={28} /></Link>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
          <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center mx-auto mb-5">
            <Lock className="text-orange-600 dark:text-orange-400" size={28} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Restricted</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-6">
            You do not have permission to view this page. Please sign in with an account that has the appropriate access level.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="w-full flex items-center justify-center h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="w-full flex items-center justify-center h-10 px-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-700 dark:text-slate-300 transition-colors"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
