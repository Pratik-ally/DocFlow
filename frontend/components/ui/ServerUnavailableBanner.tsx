'use client';
import React, { useEffect, useState } from 'react';
import { healthApi } from '@/services/api';
import { WifiOff } from 'lucide-react';

/**
 * Polls GET /api/health once on mount.
 * If the backend is unreachable, renders a non-crashing banner.
 * No stack traces are shown to users.
 */
export function ServerUnavailableBanner() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    let active = true;
    const checkHealth = () => {
      healthApi.check()
        .then(() => { if (active) setDown(false); })
        .catch(() => { if (active) setDown(true); });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!down) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 text-sm text-amber-800 dark:text-amber-300">
      <WifiOff size={16} className="flex-shrink-0 text-amber-600 dark:text-amber-400" />
      <span>
        <strong>Server unavailable</strong> — the backend API is not responding.
        Please start the backend server and try again.
      </span>
    </div>
  );
}
