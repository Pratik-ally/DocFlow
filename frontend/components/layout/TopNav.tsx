'use client';
import React, { useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { notificationApi, authApi } from '@/services/api';
import { Notification } from '@/types';
import type { Hospital } from '@/types';
import { timeAgo } from '@/lib/utils';

export default function TopNav({ title }: { title?: string }) {
  const { user, loading: authLoading, logout } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hospitalName, setHospitalName] = useState<string>('');

  useEffect(() => {
    authApi.getHospitalPublic()
      .then((r) => {
        const h = r.data.hospital as Hospital | null;
        if (h?.name) setHospitalName(h.name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading || !user) {
      setNotifs([]);
      return;
    }

    let active = true;
    notificationApi.getAll()
      .then((r) => {
        if (active) setNotifs(r.data.notifications || []);
      })
      .catch((error: unknown) => {
        if (active) console.error('Could not load notifications:', error);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const unread = notifs.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    await notificationApi.markRead(id).catch(() => {});
    setNotifs((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
  };

  const roleLabel: Record<string, string> = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    DOCTOR: 'Doctor',
    STAFF: 'Staff',
    PATIENT: 'Patient',
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm dark:shadow-slate-900/50">
      <div className="flex flex-col">
        {hospitalName && (
          <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">{hospitalName}</span>
        )}
        {title && <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-500 dark:text-slate-400"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 mt-1 w-80 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
                {unread > 0 && (
                  <button
                    className="text-xs text-blue-600 dark:text-sky-400 hover:underline"
                    onClick={() => {
                      notificationApi.markAllRead().catch(() => {});
                      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">No notifications</div>
                ) : (
                  notifs.map((n) => (
                    <button
                      key={n._id}
                      onClick={() => markRead(n._id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${!n.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{n.message}</div>
                        </div>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">{timeAgo(n.createdAt)}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User info + Logout */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">{user.name[0].toUpperCase()}</span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-gray-800 dark:text-slate-200">{user.name}</div>
                <div className="text-xs text-gray-400 dark:text-slate-500">{roleLabel[user.role] ?? user.role}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-2 rounded-lg text-gray-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
