'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { adminApi, getApiErrorMessage } from '@/services/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import OwnerOnboardingChecklist from '@/components/admin/OwnerOnboardingChecklist';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardStats } from '@/types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Calendar, Users, CheckCircle, AlertTriangle, Clock, TrendingDown, Activity } from 'lucide-react';

interface TrendItem { _id: string; total: number; completed: number; cancelled: number; highPriority: number }
interface DistItem { _id: string; count: number }
interface DeptItem { _id: string; total: number; completed: number; completionRate: number }

const PIE_COLORS = { HIGH: '#ef4444', SOON: '#f59e0b', ROUTINE: '#10b981' };
const CHART_COLORS = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [dist, setDist] = useState<DistItem[]>([]);
  const [deptPerf, setDeptPerf] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, trendsRes, distRes, deptRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getTrends(),
        adminApi.getPriorityDistribution(),
        adminApi.getDepartmentPerformance(),
      ]);
      setStats(statsRes.data.stats);
      setTrends(trendsRes.data.trends || []);
      setDist(distRes.data.distribution || []);
      setDeptPerf(deptRes.data.performance || []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not load analytics.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    void loadAnalytics();
  }, [authLoading, user, loadAnalytics]);

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const kpis = [
    { label: "Today's Appointments", value: stats?.todayAppointments ?? 0, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Patients', value: stats?.totalPatients ?? 0, icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Completed Today', value: stats?.completed ?? 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'High Priority', value: stats?.highPriority ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Avg Wait Time', value: `${stats?.avgWait ?? 0} min`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'No-Show Rate', value: `${stats?.noShowRate ?? 0}%`, icon: TrendingDown, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const pieData = dist.map((d) => ({
    name: d._id,
    value: d.count,
    color: PIE_COLORS[d._id as keyof typeof PIE_COLORS] || '#6b7280',
  }));

  const last7 = trends.slice(-7);

  return (
    <DashboardLayout title="Analytics Dashboard">
      <div className="space-y-6">
        {user?.role === 'OWNER' && <OwnerOnboardingChecklist />}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <span>{error}</span>
            <button type="button" onClick={() => { void loadAnalytics(); }} className="rounded-md border border-current px-3 py-1.5 font-medium hover:bg-red-100 dark:hover:bg-red-900/40">
              Retry
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-4 pb-4">
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
                  <k.icon size={16} className={k.color} />
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{k.value}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 leading-tight mt-0.5">{k.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Appointment Trends - takes 2 cols */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Appointment Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trends} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f3f4f6)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10, fill: 'currentColor' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', fontSize: '12px' }}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total" />
                  <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={false} name="Completed" />
                  <Line type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={2} dot={false} name="Cancelled" />
                  <Line type="monotone" dataKey="highPriority" stroke="#f59e0b" strokeWidth={2} dot={false} name="High Priority" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-gray-400">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                          <span className="text-gray-600 dark:text-slate-400">{d.name}</span>
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-slate-200">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Department Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Department Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deptPerf} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f3f4f6)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10, fill: 'currentColor' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: '12px' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent weekly throughput */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Patient Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={last7} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f3f4f6)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10, fill: 'currentColor' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: '12px' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="total" fill="#8b5cf6" name="Total" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="highPriority" fill="#ef4444" name="High Priority" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Department table */}
        {deptPerf.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Department Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['Department', 'Total', 'Completed', 'Cancelled', 'No-Show', 'Completion Rate'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deptPerf.map((d) => (
                      <tr key={d._id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{d._id}</td>
                        <td className="px-3 py-3 text-gray-600 dark:text-slate-400">{d.total}</td>
                        <td className="px-3 py-3 text-green-600 dark:text-green-400">{d.completed}</td>
                        <td className="px-3 py-3 text-gray-500 dark:text-slate-500">{(d as { cancelled?: number }).cancelled ?? 0}</td>
                        <td className="px-3 py-3 text-red-500 dark:text-red-400">{(d as { noShow?: number }).noShow ?? 0}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full max-w-[80px]">
                              <div className="h-full bg-green-500 dark:bg-green-400 rounded-full" style={{ width: `${Math.min(100, d.completionRate)}%` }} />
                            </div>
                            <span className="text-xs text-gray-600 dark:text-slate-300 font-medium">{d.completionRate.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
