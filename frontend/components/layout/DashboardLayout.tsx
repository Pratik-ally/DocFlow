'use client';
import React from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import { ServerUnavailableBanner } from '@/components/ui/ServerUnavailableBanner';

export default function DashboardLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <ServerUnavailableBanner />
        <TopNav title={title} />
        <main className="flex-1 p-6 overflow-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
