'use client';
import React, { useEffect, useState } from 'react';
import { queueApi } from '@/services/api';
import { QueueEntry } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Hash, Activity, Wifi } from 'lucide-react';

export default function PatientQueuePage() {
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [patientsAhead, setPatientsAhead] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [connected, setConnected] = useState(false);

  const fetchQueue = async () => {
    try {
      const res = await queueApi.getMyPosition();
      setEntry(res.data.entry || null);
      setPatientsAhead(res.data.patientsAhead || 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQueue().finally(() => setLoading(false));

    // Route SSE through the Next.js rewrite proxy (/backend-api → backend)
    // so the browser auth cookie is forwarded correctly.
    const sse = new EventSource('/backend-api/queue/sse?channel=global', { withCredentials: true });

    sse.onopen = () => setConnected(true);
    sse.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'queue_update') {
        fetchQueue();
      }
    };
    sse.onerror = () => setConnected(false);

    return () => sse.close();
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Queue Status">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Queue Status">
      <div className="max-w-3xl space-y-5">
        {/* Connection indicator */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${connected ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700'}`}>
          <Wifi size={11} />
          {connected ? 'Real-time updates active' : 'Connecting...'}
          <span className="text-gray-400 dark:text-slate-500 ml-1">· Updated {lastUpdated.toLocaleTimeString()}</span>
        </div>

        {!entry ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Activity className="mx-auto text-gray-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="font-semibold text-gray-700 dark:text-slate-300">Not in queue</h3>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">You are not currently checked in to any queue.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Main queue card */}
            <Card className={entry.priority === 'HIGH' ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30' : entry.priority === 'SOON' ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Your Queue Position</p>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-6xl font-black text-gray-900 dark:text-white">#{entry.queuePosition}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge priority={entry.priority} />
                    <div className="mt-2">
                      <Badge status={entry.status} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
                    <Users size={16} className="mx-auto text-gray-400 dark:text-slate-500 mb-1" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{patientsAhead}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">Ahead of you</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
                    <Clock size={16} className="mx-auto text-amber-500 mb-1" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{entry.estimatedWaitTime}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">Min. estimated wait</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
                    <Hash size={16} className="mx-auto text-blue-500 mb-1" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{entry.queuePosition}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">Queue number</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appointment details */}
            {entry.appointmentId && (
              <Card>
                <CardHeader><CardTitle>Appointment Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-slate-400">Appointment ID</span>
                        <span className="font-mono font-medium text-gray-800 dark:text-slate-200">{entry.appointmentId.appointmentId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-slate-400">Doctor</span>
                        <span className="font-medium text-gray-800 dark:text-slate-200">{(entry.doctorId as { userId?: { name?: string } })?.userId?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-slate-400">Department</span>
                        <span className="font-medium text-gray-800 dark:text-slate-200">{entry.departmentId?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-slate-400">Appointment Time</span>
                        <span className="font-medium text-gray-800 dark:text-slate-200">{entry.appointmentId.appointmentTime}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-slate-400">Reason</span>
                        <span className="font-medium text-gray-800 dark:text-slate-200 text-right max-w-xs">{entry.appointmentId.reason}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-800/50">
              <CardContent className="pt-5">
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3 text-sm">Instructions</h3>
                <ul className="space-y-1.5 text-xs text-blue-800 dark:text-blue-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 dark:text-blue-500 mt-0.5">•</span>
                    Please remain in the waiting area near your designated department.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 dark:text-blue-500 mt-0.5">•</span>
                    This page updates automatically — no need to refresh.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 dark:text-blue-500 mt-0.5">•</span>
                    You will be called by name when it is your turn.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
