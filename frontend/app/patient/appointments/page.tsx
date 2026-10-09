'use client';
import React, { useEffect, useState } from 'react';
import { appointmentApi } from '@/services/api';
import { Appointment } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatTime } from '@/lib/utils';
import Link from 'next/link';
import { Calendar, Plus, Filter } from 'lucide-react';

const STATUS_FILTERS = ['ALL', 'BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = filter !== 'ALL' ? { status: filter } : {};
    appointmentApi.getMyAppointments(params)
      .then((r) => setAppointments(r.data.appointments || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <DashboardLayout title="My Appointments">
      <div className="max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <Link href="/patient/appointments/new">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus size={14} />
              New Appointment
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : appointments.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="mx-auto text-gray-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="font-semibold text-gray-700 dark:text-slate-300">No appointments found</h3>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                {filter !== 'ALL' ? `No ${filter.toLowerCase()} appointments` : 'Book your first appointment'}
              </p>
              <Link href="/patient/appointments/new">
                <Button size="sm" className="mt-4">Book Appointment</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => (
              <Card key={appt._id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                        <Calendar size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {(appt.doctorId as { userId?: { name?: string } })?.userId?.name || 'Doctor'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">{appt.departmentId?.name}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                          {formatDate(appt.appointmentDate)} at {formatTime(appt.appointmentTime)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge priority={appt.priority} />
                      <Badge status={appt.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-400 dark:text-slate-500">Reason: </span>
                      <span className="text-xs text-gray-600 dark:text-slate-400">{appt.reason}</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{appt.appointmentId}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
