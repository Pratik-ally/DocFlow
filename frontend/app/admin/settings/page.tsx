'use client';
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Database, Cpu, Globe } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <DashboardLayout title="System Settings">
      <div className="max-w-3xl space-y-5">
        <Card>
          <CardHeader><CardTitle>Environment Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'MONGODB_URI', value: 'Connected ✓', color: 'text-green-600' },
              { label: 'JWT_SECRET', value: '••••••••••••••••', color: 'text-gray-500' },
              { label: 'NODE_ENV', value: process.env.NODE_ENV || 'development', color: 'text-blue-600' },
              { label: 'API Version', value: 'v1.0.0', color: 'text-gray-600' },
            ].map((c) => (
              <div key={c.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-mono text-gray-700">{c.label}</span>
                <span className={`text-sm font-medium ${c.color}`}>{c.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">Demo Mode Active</p>
                <p className="text-xs text-amber-700 mt-1">This is a demonstration environment. Settings management is not available in demo mode. In a production deployment, administrators can manage hospitals, departments, users, and system configuration here.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>System Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: Globe, label: 'Frontend', value: 'Next.js 14 + TypeScript + Tailwind CSS' },
              { icon: Cpu, label: 'Backend', value: 'Node.js + Express.js + TypeScript' },
              { icon: Database, label: 'Database', value: 'MongoDB + Mongoose ODM' },
              { icon: Shield, label: 'Authentication', value: 'JWT + HTTP-only Cookies + bcrypt + RBAC' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <item.icon size={16} className="text-gray-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-400">{item.label}</div>
                  <div className="text-sm font-medium text-gray-800">{item.value}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
