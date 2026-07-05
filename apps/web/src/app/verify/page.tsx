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
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8 text-muted-foreground sm:px-6">Loading...</div>
      }
    >
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
