'use client';
import React, { useEffect, useState } from 'react';
import { queueApi } from '@/services/api';
import { QueueEntry } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Wifi } from 'lucide-react';

export default function StaffQueuePage() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchQueue = async () => {
    try {
      const res = await queueApi.getQueue();
      setQueue(res.data.queue || []);
      setLastUpdated(new Date());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchQueue().finally(() => setLoading(false));

    // Route SSE through the Next.js rewrite proxy (/backend-api → backend)
    // so the browser auth cookie is forwarded correctly.
    const sse = new EventSource('/backend-api/queue/sse?channel=global', { withCredentials: true });
    sse.onopen = () => setConnected(true);
    sse.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'queue_update') fetchQueue();
    };
    sse.onerror = () => setConnected(false);
    return () => sse.close();
  }, []);

  const updateEntry = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await queueApi.updateEntry(id, { status });
      await fetchQueue();
    } finally { setUpdating(null); }
  };

  return (
    <DashboardLayout title="Live Queue Management">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${connected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            <Wifi size={11} />
            {connected ? 'Live updates active' : 'Connecting...'}
            <span className="text-gray-400 ml-1">· {lastUpdated.toLocaleTimeString()}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchQueue} className="flex items-center gap-1.5">
            <RefreshCcw size={13} /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Current Queue ({queue.length} patients)</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : queue.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">Queue is empty</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Pos', 'Patient', 'Dept', 'Doctor', 'Time', 'Priority', 'Wait', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((entry) => (
                      <tr key={entry._id} className={`border-b border-gray-50 hover:bg-gray-50 ${entry.priority === 'HIGH' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-3 py-3 font-bold text-lg text-gray-700">#{entry.queuePosition}</td>
                        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {(entry.patientId as { userId?: { name?: string } })?.userId?.name}
                        </td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{entry.departmentId?.name}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                          {(entry.doctorId as { userId?: { name?: string } })?.userId?.name}
                        </td>
                        <td className="px-3 py-3 text-gray-500">{entry.appointmentId?.appointmentTime}</td>
                        <td className="px-3 py-3"><Badge priority={entry.priority} /></td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-600">{entry.estimatedWaitTime} min</td>
                        <td className="px-3 py-3"><Badge status={entry.status} /></td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            {entry.status === 'WAITING' && (
                              <Button size="sm" className="text-xs h-7 px-2" loading={updating === entry._id}
                                onClick={() => updateEntry(entry._id, 'IN_CONSULTATION')}>
                                Call In
                              </Button>
                            )}
                            {entry.status === 'IN_CONSULTATION' && (
                              <Button size="sm" variant="secondary" className="text-xs h-7 px-2" loading={updating === entry._id}
                                onClick={() => updateEntry(entry._id, 'COMPLETED')}>
                                Done
                              </Button>
                            )}
                          </div>
                        </td>
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
