'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Calendar, Users, Settings, LogOut,
  ChevronLeft, ChevronRight, BarChart2, Clock, User,
  List
} from 'lucide-react';
import { DocFlowLogo, DocFlowIcon } from '@/components/ui/DocFlowLogo';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const patientNav: NavItem[] = [
  { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutDashboard },
  { label: 'Appointments', href: '/patient/appointments', icon: Calendar },
  { label: 'Queue Status', href: '/patient/queue', icon: Clock },
  { label: 'Profile', href: '/patient/profile', icon: User },
];

const doctorNav: NavItem[] = [
  { label: 'Dashboard', href: '/doctor/dashboard', icon: LayoutDashboard },
  { label: 'Appointments', href: '/doctor/appointments', icon: Calendar },
  { label: 'My Patients', href: '/doctor/patients', icon: Users },
];

const staffNav: NavItem[] = [
  { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
  { label: 'Appointments', href: '/staff/appointments', icon: Calendar },
  { label: 'Queue', href: '/staff/queue', icon: List },
  { label: 'Patients', href: '/staff/patients', icon: Users },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart2 },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

function getNav(role?: string) {
  switch (role) {
    case 'PATIENT': return patientNav;
    case 'DOCTOR': return doctorNav;
    case 'STAFF': return staffNav;
    case 'ADMIN': return adminNav;
    default: return [];
  }
}

function getRoleLabel(role?: string) {
  const map: Record<string, string> = {
    PATIENT: 'Patient Portal',
    DOCTOR: 'Doctor Portal',
    STAFF: 'Staff Portal',
    ADMIN: 'Admin Portal',
  };
  return map[role || ''] || 'Portal';
}

function getRoleColor(role?: string) {
  const map: Record<string, string> = {
    PATIENT: 'from-blue-600 to-teal-600',
    DOCTOR: 'from-teal-600 to-cyan-600',
    STAFF: 'from-indigo-600 to-blue-600',
    ADMIN: 'from-purple-600 to-indigo-600',
  };
  return map[role || ''] || 'from-blue-600 to-teal-600';
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const nav = getNav(user?.role);

  return (
    <aside className={cn(
      'flex flex-col bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 shadow-sm transition-all duration-200 min-h-screen',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo / branding */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-slate-800', collapsed && 'justify-center px-2')}>
        {collapsed ? (
          <DocFlowIcon size={36} />
        ) : (
          <div className="flex flex-col">
            <DocFlowLogo size={28} textSize="text-sm" />
            <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 pl-9">{getRoleLabel(user?.role)}</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className={active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn('px-2 py-3 border-t border-gray-100 dark:border-slate-800 space-y-0.5', collapsed && 'px-1')}>
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">{user.name[0].toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">{user.name}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && 'Sign Out'}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-400 dark:text-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
