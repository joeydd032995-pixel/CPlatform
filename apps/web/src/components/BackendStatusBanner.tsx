'use client';

import { WifiOff } from 'lucide-react';
import { useUser } from '@/lib/user-context';

// Distinct from the Header's balance "--" fallback: this is a loud,
// full-width banner for when the frontend loaded fine but every API
// request is failing (backend crashed, misconfigured proxy, etc.) -- the
// exact failure mode that previously only showed up as a silent "--".
export function BackendStatusBanner() {
  const { backendConnected } = useUser();

  if (backendConnected) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 border-b border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Backend not connected — retrying…</span>
    </div>
  );
}
