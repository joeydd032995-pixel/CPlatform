import { Suspense } from 'react';
import { parseVerifySearchParams } from '@/lib/verify-link';
import { VerifyForm } from '@/components/VerifyForm';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const parsed = parseVerifySearchParams(resolved);

  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <VerifyForm
        initialGame={parsed.game}
        initialServerSeed={parsed.serverSeed}
        initialClientSeed={parsed.clientSeed}
        initialNonce={parsed.nonce}
        initialParams={parsed.params}
      />
    </Suspense>
  );
}
