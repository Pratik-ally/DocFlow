'use client';
import React from 'react';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Phone, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PatientProfilePage() {
  const { user } = useAuth();

  return (
    <DashboardLayout title="My Profile">
      <div className="max-w-2xl space-y-5">
        <Card>
          <CardHeader><CardTitle>Account Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{user?.name}</h3>
                <Badge className="text-xs">{user?.role}</Badge>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              {[
                { icon: User, label: 'Full Name', value: user?.name },
                { icon: Mail, label: 'Email Address', value: user?.email },
                { icon: Phone, label: 'Phone', value: user?.phone || 'Not set' },
                { icon: Shield, label: 'Role', value: user?.role },
              ].map((field) => (
                <div key={field.label} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <field.icon size={16} className="text-gray-400 dark:text-slate-500" />
                  <div>
                    <div className="text-xs text-gray-400 dark:text-slate-500">{field.label}</div>
                    <div className="text-sm font-medium text-gray-800 dark:text-slate-200">{field.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-800/50">
          <CardContent className="pt-5">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Demo Account:</strong> This is a demonstration platform. Profile editing is not enabled in the demo version.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
