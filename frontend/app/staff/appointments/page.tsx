'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { appointmentApi, getApiErrorMessage } from '@/services/api';
import { Appointment, AppointmentStatus } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { calcAge, formatDate } from '@/lib/utils';
import { Calendar, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-context';

const STATUS_FILTERS = [
  'ALL', 'BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING',
  'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
] as const;

type DateFilter = 'today' | 'upcoming' | 'all';

export default function StaffAppointmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (dateFilter === 'today') params.date = today;
      if (dateFilter === 'upcoming') params.fromDate = today;
      const response = await appointmentApi.getAll(params);
      setAppointments(response.data.appointments || []);
      setError(null);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not load appointments.'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter, today]);

  useEffect(() => {
    if (!authLoading && user) void fetchAppointments();
  }, [authLoading, user, fetchAppointments]);

  const visibleAppointments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return appointments;
    return appointments.filter((appointment) => {
      const patient = appointment.patientId?.userId;
      const doctor = appointment.doctorId?.userId;
      return [
        patient?.name,
        patient?.email,
        patient?.phone,
        doctor?.name,
        appointment.appointmentId,
        appointment.reason,
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [appointments, search]);

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setUpdatingId(id);
    setError(null);
    try {
      await appointmentApi.updateStatus(id, status);
      await fetchAppointments();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not update this appointment.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout title="Appointments">
      <div className="max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Appointment Management</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Review appointments across the clinic and manage check-in and status.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchAppointments()} disabled={loading}>
            <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void fetchAppointments()}>Retry</Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Appointments</CardTitle>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {visibleAppointments.length} shown
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3">
              {([
                ['today', 'Today'],
                ['upcoming', 'Upcoming'],
                ['all', 'All dates'],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={dateFilter === value ? 'default' : 'outline'}
                  aria-pressed={dateFilter === value}
                  onClick={() => setDateFilter(value)}
                >
                  {label}
                </Button>
              ))}
              <div className="relative min-w-56 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  aria-label="Search appointments"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient, doctor, or reference"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  aria-pressed={statusFilter === status}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {status.replaceAll('_', ' ')}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-40 items-center justify-center" aria-label="Loading appointments">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : visibleAppointments.length === 0 ? (
              <div className="py-14 text-center">
                <Calendar className="mx-auto mb-3 text-gray-300 dark:text-slate-700" size={38} />
                <h3 className="font-semibold text-gray-700 dark:text-slate-300">No appointments found</h3>
                <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">
                  {search.trim() ? 'Try another search term or change the filters.' : 'There are no appointments for the selected filters.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['Patient', 'Doctor', 'Date', 'Time', 'Reason', 'Priority', 'Status', 'Action'].map((heading) => (
                        <th key={heading} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAppointments.map((appointment) => {
                      const patientName = appointment.patientId?.userId?.name || 'Patient';
                      const doctorName = appointment.doctorId?.userId?.name || 'Doctor';
                      const age = appointment.patientId?.dateOfBirth
                        ? calcAge(appointment.patientId.dateOfBirth)
                        : null;
                      const nextStatus: AppointmentStatus | null =
                        ['BOOKED', 'CONFIRMED'].includes(appointment.status)
                          ? 'CHECKED_IN'
                          : appointment.status === 'CHECKED_IN' ? 'WAITING' : null;
                      return (
                        <tr key={appointment._id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800">
                          <td className="px-3 py-3">
                            <div className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{patientName}</div>
                            {age !== null && <div className="text-xs text-gray-400 dark:text-slate-500">{age} yrs</div>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-slate-400">{doctorName}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-slate-400">{formatDate(appointment.appointmentDate)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-slate-400">{appointment.appointmentTime}</td>
                          <td className="max-w-[220px] truncate px-3 py-3 text-gray-600 dark:text-slate-400" title={appointment.reason}>{appointment.reason}</td>
                          <td className="px-3 py-3"><Badge priority={appointment.priority} /></td>
                          <td className="px-3 py-3"><Badge status={appointment.status} /></td>
                          <td className="px-3 py-3">
                            {nextStatus && (
                              <Button
                                size="sm"
                                className="h-7 whitespace-nowrap px-2 text-xs"
                                disabled={updatingId === appointment._id}
                                onClick={() => void updateStatus(appointment._id, nextStatus)}
                              >
                                {updatingId === appointment._id ? 'Updating…' : nextStatus === 'CHECKED_IN' ? 'Check in' : 'Add to queue'}
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
