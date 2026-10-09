import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'priority' | 'status';
  priority?: 'ROUTINE' | 'SOON' | 'HIGH';
  status?: string;
}

export function Badge({ className, variant = 'default', priority, status, children, ...props }: BadgeProps) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border';

  if (priority) {
    const priorityClasses = {
      HIGH: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/60',
      SOON: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
      ROUTINE: 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/60',
    };
    return <span className={cn(base, priorityClasses[priority], className)} {...props}>{children || priority}</span>;
  }

  if (status) {
    const statusClasses: Record<string, string> = {
      BOOKED: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
      CONFIRMED: 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40',
      CHECKED_IN: 'bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/40',
      WAITING: 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
      IN_CONSULTATION: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/40',
      COMPLETED: 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40',
      CANCELLED: 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700',
      NO_SHOW: 'bg-red-50 dark:bg-red-900/40 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800/40',
    };
    return (
      <span className={cn(base, statusClasses[status] || 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700', className)} {...props}>
        {children || status.replace(/_/g, ' ')}
      </span>
    );
  }

  return (
    <span className={cn(base, 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700', className)} {...props}>
      {children}
    </span>
  );
}
