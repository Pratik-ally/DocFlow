'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Circle, RefreshCw } from 'lucide-react';
import { adminApi, getApiErrorMessage, hospitalApi } from '@/services/api';

interface SetupResponse {
  hospital: { logoUrl?: string };
  departments: { _id: string }[];
}

interface TeamResponse {
  members: { role: string }[];
}

const tasks = [
  { label: 'Add your hospital departments', href: '/admin/settings' },
  { label: 'Add your first doctor', href: '/admin/users' },
  { label: 'Invite your staff', href: '/admin/users' },
  { label: 'Upload your hospital logo', href: '/admin/settings' },
];

export default function OwnerOnboardingChecklist() {
  const [completed, setCompleted] = useState<boolean[]>(tasks.map(() => false));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadProgress() {
      try {
        const [settingsResponse, doctorResponse, staffResponse] = await Promise.all([
          hospitalApi.getManageSettings(),
          adminApi.getTeam({ role: 'DOCTOR', status: 'ACTIVE', limit: '1' }),
          adminApi.getTeam({ role: 'STAFF', status: 'ACTIVE', limit: '1' }),
        ]);
        const settings = settingsResponse.data as SetupResponse;
        const doctors = doctorResponse.data as TeamResponse;
        const staff = staffResponse.data as TeamResponse;
        if (!cancelled) {
          setCompleted([
            (settings.departments ?? []).length > 0,
            (doctors.members ?? []).length > 0,
            (staff.members ?? []).length > 0,
            Boolean(settings.hospital?.logoUrl),
          ]);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Setup progress is temporarily unavailable.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProgress();
    return () => { cancelled = true; };
  }, [refresh]);

  const doneCount = completed.filter(Boolean).length;

  return (
    <section aria-labelledby="owner-onboarding-title" className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="owner-onboarding-title" className="text-lg font-semibold text-slate-900 dark:text-white">Get your hospital ready</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Complete these setup steps to prepare your DocFlow workspace.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-slate-900 dark:text-indigo-300">
          {loading ? 'Checking setup…' : `${doneCount} of ${tasks.length} complete`}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-slate-800" role="progressbar" aria-label="Hospital setup progress" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={doneCount}>
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(doneCount / tasks.length) * 100}%` }} />
      </div>
      {error && <p role="status" className="mt-3 text-xs text-amber-800 dark:text-amber-300">{error}</p>}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {tasks.map((task, index) => {
          const isComplete = completed[index];
          return (
            <li key={task.label} className="flex items-center gap-3 rounded-lg bg-white px-3 py-3 dark:bg-slate-900">
              {isComplete
                ? <Check size={18} className="shrink-0 text-green-600" aria-label="Complete" />
                : <Circle size={18} className="shrink-0 text-slate-400" aria-hidden="true" />}
              <Link href={task.href} className={`text-sm font-medium hover:underline ${isComplete ? 'text-slate-500 line-through dark:text-slate-400' : 'text-indigo-700 dark:text-indigo-300'}`}>
                {task.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {doneCount === tasks.length && !loading && (
        <p className="mt-4 text-sm font-medium text-green-700 dark:text-green-300">Your hospital setup is complete.</p>
      )}
      {error && (
        <button type="button" onClick={() => { setLoading(true); setError(''); setRefresh((current) => current + 1); }} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300">
          <RefreshCw size={13} aria-hidden="true" /> Refresh setup status
        </button>
      )}
    </section>
  );
}
