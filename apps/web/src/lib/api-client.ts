// Typed fetch wrapper. Relative `/api/...` URLs -- next.config.ts's
// rewrites() proxies these to the real API origin, so this file never needs
// to know that origin itself. Takes `userId` as an argument everywhere
// (never reads localStorage itself) so it stays unit-testable without a
// DOM/localStorage shim.
import type {
  MeResponse,
  PlayGameResult,
  PublicSeedState,
  RevealedSeedRecord,
  VerifyResponse,
  ApiErrorBody,
} from './types';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues?: string[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.error);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
    this.issues = body.issues;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { userId?: string; idempotencyKey?: string } = {}
): Promise<T> {
  const { userId, idempotencyKey, headers, ...rest } = init;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (userId) finalHeaders['x-user-id'] = userId;
  if (idempotencyKey) finalHeaders['idempotency-key'] = idempotencyKey;

  const res = await fetch(path, { ...rest, headers: finalHeaders });

  if (!res.ok) {
    let body: ApiErrorBody;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = { code: 'UNKNOWN', error: `Request failed with status ${res.status}` };
    }
    throw new ApiError(res.status, body);
  }

  return (await res.json()) as T;
}

export function playGame(
  userId: string,
  game: string,
  body: { betAmount: number; params: unknown },
  idempotencyKey?: string
): Promise<PlayGameResult> {
  return request<PlayGameResult>(`/api/games/${game}`, {
    method: 'POST',
    userId,
    idempotencyKey,
    body: JSON.stringify(body),
  });
}

export function getSeeds(userId: string): Promise<PublicSeedState> {
  return request<PublicSeedState>('/api/seeds', {
    method: 'GET',
    userId,
  });
}

export function rotateSeed(
  userId: string,
  idempotencyKey?: string
): Promise<RevealedSeedRecord> {
  return request<RevealedSeedRecord>('/api/seeds/rotate', {
    method: 'POST',
    userId,
    idempotencyKey,
  });
}

export function setClientSeed(
  userId: string,
  clientSeed: string
): Promise<PublicSeedState> {
  return request<PublicSeedState>('/api/seeds/client-seed', {
    method: 'POST',
    userId,
    body: JSON.stringify({ clientSeed }),
  });
}

export interface VerifyBetBody {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  game: string;
  params: unknown;
}

export function verifyBet(body: VerifyBetBody): Promise<VerifyResponse> {
  return request<VerifyResponse>('/api/verify', {
    method: 'POST',
    // Public, unauthenticated route -- no x-user-id header.
    body: JSON.stringify({ ...body, version: '1.1' }),
  });
}

export function getMe(userId: string): Promise<MeResponse> {
  return request<MeResponse>('/api/me', {
    method: 'GET',
    userId,
  });
}
