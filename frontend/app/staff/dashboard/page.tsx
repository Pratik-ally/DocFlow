'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { adminApi, appointmentApi, getApiErrorMessage, queueApi } from '@/services/api';
import { Appointment, QueueEntry, DashboardStats } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { formatDate, formatTime, calcAge } from '@/lib/utils';
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, TrendingDown, ArrowUp, ArrowDown, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';

export default function StaffDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'today' | 'upcoming' | 'date'>('today');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const appointmentParams = scheduleMode === 'upcoming'
        ? { fromDate: today, limit: 100 }
        : { date: scheduleMode === 'date' ? selectedDate : today, limit: 100 };
      const [statsResult, queueResult, appointmentResult] = await Promise.allSettled([
        adminApi.getStats(),
        queueApi.getQueue({ date: today }),
        appointmentApi.getAll(appointmentParams),
      ]);
      const errors: string[] = [];
      if (statsResult.status === 'fulfilled') setStats(statsResult.value.data.stats);
      else errors.push(getApiErrorMessage(statsResult.reason, 'Could not load dashboard statistics.'));
      if (queueResult.status === 'fulfilled') setQueue(queueResult.value.data.queue || []);
      else errors.push(getApiErrorMessage(queueResult.reason, 'Could not load the live queue.'));
      if (appointmentResult.status === 'fulfilled') setAppointments(appointmentResult.value.data.appointments || []);
      else errors.push(getApiErrorMessage(appointmentResult.reason, 'Could not load appointments.'));
      setError(errors.length ? errors.join(' ') : null);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not load the staff dashboard.'));
    } finally {
      setLoading(false);
    }
  }, [scheduleMode, selectedDate, today, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    void fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [authLoading, user, fetchData]);

  const updateQueueEntry = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await queueApi.updateEntry(id, { status });
      await fetchData();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not update the queue entry.'));
    } finally {
      setUpdating(null);
    }
  };

  const updateApptStatus = async (id: string, status: string) => {
    try {
      await appointmentApi.updateStatus(id, status);
      await fetchData();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not update the appointment.'));
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Staff Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const kpiCards = [
    { icon: Calendar, value: stats?.todayAppointments ?? 0, color: 'text-blue-600', bg: 'bg-blue-50', sublabel: "Today's Appointments" },
    { icon: Users, value: stats?.waitingPatients ?? 0, color: 'text-amber-600', bg: 'bg-amber-50', sublabel: 'Waiting Patients' },
    { icon: AlertTriangle, value: stats?.highPriority ?? 0, color: 'text-red-600', bg: 'bg-red-50', sublabel: 'High Priority' },
    { icon: CheckCircle, value: stats?.completed ?? 0, color: 'text-green-600', bg: 'bg-green-50', sublabel: 'Completed' },
    { icon: Clock, value: `${stats?.avgWait ?? 0} min`, color: 'text-indigo-600', bg: 'bg-indigo-50', sublabel: 'Avg Wait Time' },
    { icon: TrendingDown, value: `${stats?.noShowRate ?? 0}%`, color: 'text-purple-600', bg: 'bg-purple-50', sublabel: 'No-Show Rate' },
  ];
  const scheduleLabel = scheduleMode === 'upcoming'
    ? 'Upcoming Appointments'
    : scheduleMode === 'date'
      ? `Appointments — ${format(new Date(`${selectedDate}T00:00:00`), 'EEEE, MMMM d')}`
      : `Appointments — ${format(new Date(`${today}T00:00:00`), 'EEEE, MMMM d')}`;

  return (
    <DashboardLayout title="Staff Dashboard">
      <div className="space-y-6">
        {error && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => { void fetchData(); }}>Retry</Button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpiCards.map((card, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                  <card.icon size={16} className={card.color} />
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 leading-tight">{card.sublabel}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Live Queue Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Live Queue — Today</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchData} className="flex items-center gap-1.5">
                <RefreshCcw size={13} /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">No patients currently in queue</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['#', 'Patient', 'Department', 'Doctor', 'Time', 'Priority', 'Wait', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((entry) => {
                      const patientName = (entry.patientId as { userId?: { name?: string } })?.userId?.name || 'Patient';
                      const doctorName = (entry.doctorId as { userId?: { name?: string } })?.userId?.name || 'Doctor';
                      return (
                        <tr key={entry._id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                          <td className="px-3 py-3 font-bold text-gray-700 dark:text-slate-300">#{entry.queuePosition}</td>
                          <td className="px-3 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{patientName}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{entry.departmentId?.name}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{doctorName}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400">{entry.appointmentId?.appointmentTime}</td>
                          <td className="px-3 py-3"><Badge priority={entry.priority} /></td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{entry.estimatedWaitTime} min</td>
                          <td className="px-3 py-3"><Badge status={entry.status} /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              {entry.status === 'WAITING' && (
                                <Button
                                  size="sm"
                                  className="text-xs h-7 px-2"
                                  loading={updating === entry._id}
                                  onClick={() => updateQueueEntry(entry._id, 'IN_CONSULTATION')}
                                >
                                  Start
                                </Button>
                              )}
                              {entry.status === 'IN_CONSULTATION' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="text-xs h-7 px-2"
                                  loading={updating === entry._id}
                                  onClick={() => updateQueueEntry(entry._id, 'COMPLETED')}
                                >
                                  Complete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointment schedule */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Appointments</CardTitle>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{scheduleLabel}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={scheduleMode === 'today' ? 'default' : 'outline'} onClick={() => setScheduleMode('today')}>Today</Button>
                <Button size="sm" variant={scheduleMode === 'upcoming' ? 'default' : 'outline'} onClick={() => setScheduleMode('upcoming')}>Upcoming</Button>
                <Input
                  aria-label="Choose appointment date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setScheduleMode('date');
                  }}
                  className="h-9 w-auto"
                />
                <span className="text-xs text-gray-400 dark:text-slate-500">{appointments.length} appointments</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">No appointments found for this schedule.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['Patient', 'Doctor', 'Dept', 'Date', 'Time', 'Reason', 'Priority', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appt) => {
                      const patientName = (appt.patientId as { userId?: { name?: string } })?.userId?.name || 'Patient';
                      const doctorName = (appt.doctorId as { userId?: { name?: string } })?.userId?.name || 'Doctor';
                      return (
                        <tr key={appt._id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800">
                          <td className="px-3 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{patientName}</td>
                          <td className="px-3 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">{doctorName}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{appt.departmentId?.name}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(appt.appointmentDate)}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400">{appt.appointmentTime}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400 max-w-[160px] truncate">{appt.reason}</td>
                          <td className="px-3 py-3"><Badge priority={appt.priority} /></td>
                          <td className="px-3 py-3"><Badge status={appt.status} /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              {appt.status === 'BOOKED' && (
                                <Button size="sm" className="text-xs h-7 px-2" onClick={() => updateApptStatus(appt._id, 'CONFIRMED')}>Confirm</Button>
                              )}
                              {appt.status === 'CONFIRMED' && (
                                <Button size="sm" variant="secondary" className="text-xs h-7 px-2" onClick={() => updateApptStatus(appt._id, 'CHECKED_IN')}>Check In</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
