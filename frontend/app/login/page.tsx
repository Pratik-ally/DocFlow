'use client';
import React, { Suspense } from 'react';
import LoginPageInner from './LoginPageInner';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
