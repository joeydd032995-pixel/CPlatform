// Builds /verify deep links. `serverSeed` is intentionally optional and
// omitted by default: a live bet's server seed hasn't been revealed yet
// (only its hash has) -- ResultPanel links WITHOUT it, while
// SeedManager's revealed-seeds table (post-rotation) links WITH it.
export type VerifyLinkParams = {
  game: string;
  nonce: number;
  clientSeed: string;
  params: unknown;
  serverSeed?: string;
};

export function buildVerifyLink({ game, nonce, clientSeed, params, serverSeed }: VerifyLinkParams): string {
  const search = new URLSearchParams();
  search.set('game', game);
  search.set('nonce', String(nonce));
  search.set('clientSeed', clientSeed);
  search.set('params', JSON.stringify(params));
  if (serverSeed) {
    search.set('serverSeed', serverSeed);
  }
  return `/verify?${search.toString()}`;
}

export type ParsedVerifyLink = {
  game?: string;
  nonce?: number;
  clientSeed?: string;
  params?: unknown;
  serverSeed?: string;
};

export function parseVerifySearchParams(
  searchParams: Record<string, string | string[] | undefined>
): ParsedVerifyLink {
  const get = (key: string): string | undefined => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const game = get('game');
  const nonceRaw = get('nonce');
  const clientSeed = get('clientSeed');
  const paramsRaw = get('params');
  const serverSeed = get('serverSeed');

  let params: unknown;
  if (paramsRaw) {
    try {
      params = JSON.parse(paramsRaw);
    } catch {
      params = undefined;
    }
  }

  return {
    game,
    nonce: nonceRaw !== undefined ? Number(nonceRaw) : undefined,
    clientSeed,
    params,
    serverSeed,
  };
}
