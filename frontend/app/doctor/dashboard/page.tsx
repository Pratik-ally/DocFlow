'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { appointmentApi, getApiErrorMessage } from '@/services/api';
import { Appointment } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { formatDate, formatTime, calcAge } from '@/lib/utils';
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-context';

export default function DoctorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'today' | 'upcoming' | 'date'>('today');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchAppointments = useCallback(async () => {
    try {
      const params = scheduleMode === 'upcoming'
        ? { fromDate: today, limit: 100 }
        : { date: scheduleMode === 'date' ? selectedDate : today, limit: 100 };
      const response = await appointmentApi.getAll(params);
      setAppointments(response.data.appointments || []);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your appointments.'));
    } finally {
      setLoading(false);
    }
  }, [scheduleMode, selectedDate, today]);

  useEffect(() => {
    if (authLoading || !user) return;
    void fetchAppointments();
    const interval = setInterval(fetchAppointments, 30000);
    return () => clearInterval(interval);
  }, [authLoading, user, fetchAppointments]);

  const scheduleLabel = scheduleMode === 'upcoming'
    ? 'Upcoming Appointments'
    : scheduleMode === 'date'
      ? `Appointments — ${format(new Date(`${selectedDate}T00:00:00`), 'EEEE, MMMM d')}`
      : `Appointments — ${format(new Date(`${today}T00:00:00`), 'EEEE, MMMM d')}`;

  const updateStatus = async (id: string, status: string, notes?: string) => {
    try {
      await appointmentApi.updateStatus(id, status, notes);
      await fetchAppointments();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the appointment.'));
    }
  };

  const waiting = appointments.filter((a) => ['WAITING', 'CHECKED_IN'].includes(a.status));
  const inConsult = appointments.find((a) => a.status === 'IN_CONSULTATION');
  const completed = appointments.filter((a) => a.status === 'COMPLETED');
  const highPriority = appointments.filter((a) => a.priority === 'HIGH');

  if (loading) {
    return (
      <DashboardLayout title="Doctor Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Doctor Dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name}!</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Here is your appointment schedule.</p>
        </div>
        {error && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); void fetchAppointments(); }}>Retry</Button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: scheduleMode === 'upcoming' ? 'Upcoming Appointments' : 'Scheduled Appointments', value: appointments.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Waiting Patients', value: waiting.length, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'High Priority', value: highPriority.length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Completed', value: completed.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Current patient */}
        {inConsult && (
          <Card className="border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-950/30">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-semibold text-sm mb-3">
                <Stethoscope size={16} />
                Currently In Consultation
              </div>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {(inConsult.patientId as { userId?: { name?: string } })?.userId?.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">{inConsult.reason}</div>
                  {inConsult.symptoms?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {inConsult.symptoms.map((s) => <Badge key={s}>{s}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Badge priority={inConsult.priority} />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateStatus(inConsult._id, 'COMPLETED')}
                  >
                    Complete Consultation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Patient list */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Patient List</CardTitle>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{scheduleLabel}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={scheduleMode === 'today' ? 'default' : 'outline'}
                  onClick={() => setScheduleMode('today')}
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={scheduleMode === 'upcoming' ? 'default' : 'outline'}
                  onClick={() => setScheduleMode('upcoming')}
                >
                  Upcoming
                </Button>
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
              <div className="py-10 text-center text-sm text-gray-400 dark:text-slate-500">No appointments found for this schedule.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['Patient', 'Date', 'Time', 'Reason', 'Symptoms', 'Priority', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appt) => {
                      const name = (appt.patientId as { userId?: { name?: string } })?.userId?.name || 'Patient';
                      const dob = (appt.patientId as { dateOfBirth?: string })?.dateOfBirth;
                      const age = dob ? calcAge(dob) : null;
                      return (
                        <tr key={appt._id} className={`border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 ${appt.priority === 'HIGH' ? 'bg-red-50/20 dark:bg-red-950/20' : ''}`}>
                          <td className="px-3 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{name}</div>
                            {age && <div className="text-xs text-gray-400 dark:text-slate-500">{age} yrs</div>}
                          </td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(appt.appointmentDate)}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{appt.appointmentTime}</td>
                          <td className="px-3 py-3 text-gray-600 dark:text-slate-400 max-w-[160px] truncate">{appt.reason}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {(appt.symptoms || []).slice(0, 2).map((s) => <Badge key={s} className="text-xs">{s}</Badge>)}
                              {(appt.symptoms?.length || 0) > 2 && <Badge className="text-xs">+{appt.symptoms.length - 2}</Badge>}
                            </div>
                          </td>
                          <td className="px-3 py-3"><Badge priority={appt.priority} /></td>
                          <td className="px-3 py-3"><Badge status={appt.status} /></td>
                          <td className="px-3 py-3">
                            {['CONFIRMED', 'WAITING', 'CHECKED_IN'].includes(appt.status) && (
                              <Button
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() => updateStatus(appt._id, 'IN_CONSULTATION')}
                              >
                                Start
                              </Button>
                            )}
                            {appt.status === 'IN_CONSULTATION' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs h-7 px-2"
                                onClick={() => updateStatus(appt._id, 'COMPLETED')}
                              >
                                Complete
                              </Button>
                            )}
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
