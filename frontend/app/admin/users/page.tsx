'use client';
import React, { useEffect, useState } from 'react';
import { adminApi } from '@/services/api';
import { User } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { Users, Search } from 'lucide-react';

const ROLE_FILTERS = ['ALL', 'PATIENT', 'DOCTOR', 'STAFF', 'ADMIN'] as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = filter !== 'ALL' ? { role: filter } : {};
    adminApi.getUsers(params)
      .then((r) => setUsers(r.data.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <DashboardLayout title="User Management">
      <div className="max-w-6xl space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Users ({users.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['Name', 'Email', 'Phone', 'Role', 'Status', 'Joined'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-slate-100">{u.name}</td>
                        <td className="px-3 py-3 text-gray-500 dark:text-slate-400">{u.email}</td>
                        <td className="px-3 py-3 text-gray-500 dark:text-slate-400">{u.phone || '—'}</td>
                        <td className="px-3 py-3"><Badge>{u.role}</Badge></td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-400 dark:text-slate-500 text-xs">{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
