'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useUser } from '@/lib/user-context';

function truncate(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function Header() {
  const { userId, balance, newIdentity } = useUser();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!userId) return;
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
      <Link href="/" className="text-lg font-bold text-slate-100">
        CPlatform
      </Link>
      <nav className="flex items-center gap-6 text-sm text-slate-300">
        <Link href="/seeds" className="hover:text-white">
          Seeds
        </Link>
        <Link href="/verify" className="hover:text-white">
          Verify
        </Link>
        <span className="text-slate-500">Balance: {balance === null ? '—' : balance.toFixed(2)}</span>
        {userId && (
          <span className="flex items-center gap-2 rounded bg-slate-900 px-2 py-1 font-mono text-xs">
            {truncate(userId)}
            <button onClick={handleCopy} className="text-blue-400 hover:text-blue-300" type="button">
              {copied ? 'copied' : 'copy'}
            </button>
            <button onClick={newIdentity} className="text-slate-500 hover:text-red-400" type="button">
              new identity
            </button>
          </span>
        )}
      </nav>
    </header>
  );
}
