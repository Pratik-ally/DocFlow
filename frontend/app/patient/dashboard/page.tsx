'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { appointmentApi, queueApi } from '@/services/api';
import { Appointment, QueueEntry } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatTime, calcAge } from '@/lib/utils';
import Link from 'next/link';
import {
  Calendar, Clock, Activity, User, ArrowRight, CheckCircle,
  AlertTriangle, Hash, Timer, TrendingUp
} from 'lucide-react';

export default function PatientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [patientsAhead, setPatientsAhead] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([
      appointmentApi.getMyAppointments({ limit: 5 }),
      queueApi.getMyPosition(),
    ]).then(([apptRes, queueRes]) => {
      setAppointments(apptRes.data.appointments || []);
      setQueueEntry(queueRes.data.entry || null);
      setPatientsAhead(queueRes.data.patientsAhead || 0);
    }).catch(console.error).finally(() => setLoading(false));
  }, [authLoading, user]);

  const upcoming = appointments.find((a) => ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING'].includes(a.status));
  const recentAppts = appointments.slice(0, 5);

  if (loading) {
    return (
      <DashboardLayout title="Patient Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6 max-w-5xl">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}!</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Here&apos;s your health dashboard overview.</p>
          </div>
          <Link href="/patient/appointments/new">
            <Button className="flex items-center gap-2">
              <Calendar size={16} />
              Book Appointment
            </Button>
          </Link>
        </div>

        {/* Queue Status Banner */}
        {queueEntry && (
          <div className={`rounded-2xl p-5 border ${queueEntry.priority === 'HIGH' ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50' : queueEntry.priority === 'SOON' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold ${queueEntry.priority === 'HIGH' ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'}`}>
                  #{queueEntry.queuePosition}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Currently in Queue</div>
                  <div className="text-sm text-gray-600 dark:text-slate-300 mt-0.5">
                    {patientsAhead > 0 ? `${patientsAhead} patient${patientsAhead > 1 ? 's' : ''} ahead of you` : 'You are next!'}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge status={queueEntry.status} />
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      <Clock size={10} className="inline mr-1" />
                      ~{queueEntry.estimatedWaitTime} min wait
                    </span>
                  </div>
                </div>
              </div>
              <Link href="/patient/queue">
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  View Queue <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Calendar,
              label: 'Total Appointments',
              value: appointments.length,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              icon: CheckCircle,
              label: 'Completed',
              value: appointments.filter((a) => a.status === 'COMPLETED').length,
              color: 'text-green-600',
              bg: 'bg-green-50',
            },
            {
              icon: Clock,
              label: 'Upcoming',
              value: appointments.filter((a) => ['BOOKED', 'CONFIRMED'].includes(a.status)).length,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50',
            },
            {
              icon: AlertTriangle,
              label: 'High Priority',
              value: appointments.filter((a) => a.priority === 'HIGH').length,
              color: 'text-red-600',
              bg: 'bg-red-50',
            },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-5">
                <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Upcoming appointment */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Appointment</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {(upcoming.doctorId as { userId?: { name?: string } })?.userId?.name || 'Doctor'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {upcoming.departmentId?.name}
                      </div>
                    </div>
                    <Badge priority={upcoming.priority} />
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <div className="text-center">
                      <div className="text-xs text-gray-400 dark:text-slate-500">Date</div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-slate-200">{formatDate(upcoming.appointmentDate)}</div>
                    </div>
                    <div className="w-px h-8 bg-gray-200 dark:bg-slate-700" />
                    <div className="text-center">
                      <div className="text-xs text-gray-400 dark:text-slate-500">Time</div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-slate-200">{formatTime(upcoming.appointmentTime)}</div>
                    </div>
                    <div className="w-px h-8 bg-gray-200 dark:bg-slate-700" />
                    <div className="text-center">
                      <div className="text-xs text-gray-400 dark:text-slate-500">Status</div>
                      <Badge status={upcoming.status} />
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-slate-500">
                    Appointment ID: <span className="font-mono text-gray-700 dark:text-slate-300">{upcoming.appointmentId}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    <span className="font-medium">Reason:</span> {upcoming.reason}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="mx-auto text-gray-300 dark:text-slate-700 mb-2" size={36} />
                  <p className="text-sm text-gray-400 dark:text-slate-500">No upcoming appointments</p>
                  <Link href="/patient/appointments/new">
                    <Button size="sm" className="mt-3">Book now</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent appointments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Appointments</CardTitle>
                <Link href="/patient/appointments" className="text-xs text-blue-600 dark:text-sky-400 hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentAppts.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-slate-500">No appointments yet</div>
              ) : (
                <div className="space-y-2">
                  {recentAppts.map((appt) => (
                    <div key={appt._id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                          {(appt.doctorId as { userId?: { name?: string } })?.userId?.name || 'Doctor'}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">{formatDate(appt.appointmentDate)} · {appt.appointmentTime}</div>
                      </div>
                      <Badge status={appt.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
