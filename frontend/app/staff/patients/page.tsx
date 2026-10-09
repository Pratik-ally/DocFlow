'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { appointmentApi, getApiErrorMessage } from '@/services/api';
import { Appointment } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { calcAge, formatDate } from '@/lib/utils';
import { Search, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type PatientRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number | null;
  gender: string;
  appointmentCount: number;
  latestAppointment: Appointment;
};

export default function StaffPatientsPage() {
  const { user, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await appointmentApi.getAll({ limit: 100 });
      setAppointments(response.data.appointments || []);
      setError(null);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not load the patient directory.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) void fetchAppointments();
  }, [authLoading, user, fetchAppointments]);

  const patients = useMemo(() => {
    const records = new Map<string, PatientRecord>();
    for (const appointment of appointments) {
      const patient = appointment.patientId;
      if (!patient?._id) continue;
      const patientUser = patient.userId;
      const name = patientUser?.name || 'Patient';
      const existing = records.get(patient._id);
      if (existing) {
        existing.appointmentCount += 1;
        if (new Date(appointment.appointmentDate) > new Date(existing.latestAppointment.appointmentDate)) {
          existing.latestAppointment = appointment;
        }
        continue;
      }
      records.set(patient._id, {
        id: patient._id,
        name,
        email: patientUser?.email || '',
        phone: patientUser?.phone || '',
        age: patient.dateOfBirth ? calcAge(patient.dateOfBirth) : null,
        gender: patient.gender || 'Not provided',
        appointmentCount: 1,
        latestAppointment: appointment,
      });
    }

    const query = search.trim().toLocaleLowerCase();
    return [...records.values()]
      .filter((patient) => !query || [patient.name, patient.email, patient.phone]
        .some((value) => value.toLocaleLowerCase().includes(query)))
      .sort((first, second) => first.name.localeCompare(second.name));
  }, [appointments, search]);

  return (
    <DashboardLayout title="Patients">
      <div className="max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Patient Directory</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Patients with appointments at the clinic.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchAppointments()} disabled={loading}>
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
              <CardTitle>Patients</CardTitle>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {patients.length} {patients.length === 1 ? 'patient' : 'patients'}
              </span>
            </div>
            <div className="relative mt-3 max-w-md">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                aria-label="Search patients"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, or phone"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-40 items-center justify-center" aria-label="Loading patients">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : patients.length === 0 ? (
              <div className="py-14 text-center">
                <Users className="mx-auto mb-3 text-gray-300 dark:text-slate-700" size={38} />
                <h3 className="font-semibold text-gray-700 dark:text-slate-300">
                  {search.trim() ? 'No matching patients' : 'No patients found'}
                </h3>
                <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">
                  {search.trim() ? 'Try a different name, email, or phone number.' : 'Patients will appear here when they have clinic appointments.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['Patient', 'Contact', 'Age', 'Gender', 'Appointments', 'Most Recent Visit', 'Status'].map((heading) => (
                        <th key={heading} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient) => (
                      <tr key={patient.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800">
                        <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-900 dark:text-white">{patient.name}</td>
                        <td className="px-3 py-3">
                          <div className="whitespace-nowrap text-gray-700 dark:text-slate-300">{patient.phone || '—'}</div>
                          {patient.email && <div className="text-xs text-gray-400 dark:text-slate-500">{patient.email}</div>}
                        </td>
                        <td className="px-3 py-3 text-gray-600 dark:text-slate-400">{patient.age ?? '—'}</td>
                        <td className="px-3 py-3 text-gray-600 dark:text-slate-400">{patient.gender}</td>
                        <td className="px-3 py-3 text-gray-600 dark:text-slate-400">{patient.appointmentCount}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-slate-400">
                          {formatDate(patient.latestAppointment.appointmentDate)}
                        </td>
                        <td className="px-3 py-3"><Badge status={patient.latestAppointment.status} /></td>
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
