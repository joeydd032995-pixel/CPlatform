import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger, deepRedact } from '../src/logger.js';

function makeCapturingLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  // Built from the real createLogger() factory — the exact same redaction
  // config production uses, not a locally re-declared copy of it.
  const testLogger = createLogger(stream);
  return { testLogger, lines };
}

describe('logger redaction (via the real createLogger factory)', () => {
  it('redacts a top-level serverSeed field', () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ serverSeed: 'a'.repeat(64) }, 'test log');
    expect(lines[0]).not.toContain('a'.repeat(64));
    expect(lines[0]).toContain('[REDACTED]');
  });

  it('redacts activeServerSeed nested under seedState', () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ seedState: { activeServerSeed: 'b'.repeat(64) } }, 'test log');
    expect(lines[0]).not.toContain('b'.repeat(64));
  });

  it('redacts req.body.serverSeed', () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ req: { body: { serverSeed: 'c'.repeat(64) } } }, 'test log');
    expect(lines[0]).not.toContain('c'.repeat(64));
  });

  it('redacts serverSeed at arbitrary depth (the fixed-depth fast-redact bug this replaces)', () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info(
      { a: { b: { c: { d: { serverSeed: 'd'.repeat(64) } } } } },
      'test log'
    );
    expect(lines[0]).not.toContain('d'.repeat(64));
  });

  it('redacts serverSeed inside arrays at depth', () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ bets: [{ rng: { serverSeed: 'e'.repeat(64) } }] }, 'test log');
    expect(lines[0]).not.toContain('e'.repeat(64));
  });

  it('does not redact unrelated fields', () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ game: 'mines', betAmount: 10 }, 'test log');
    expect(lines[0]).toContain('mines');
    expect(lines[0]).toContain('10');
  });
});

describe('deepRedact (unit-level, the actual redaction function production uses)', () => {
  it('redacts sensitive keys at any depth without mutating structure shape', () => {
    const input = { a: { b: { serverSeed: 'x'.repeat(64), keep: 1 } } };
    const result = deepRedact(input) as any;
    expect(result.a.b.serverSeed).toBe('[REDACTED]');
    expect(result.a.b.keep).toBe(1);
  });

  it('handles circular references without infinite recursion', () => {
    const circular: any = { name: 'test' };
    circular.self = circular;
    expect(() => deepRedact(circular)).not.toThrow();
  });

  it('leaves primitives untouched', () => {
    expect(deepRedact(42)).toBe(42);
    expect(deepRedact('hello')).toBe('hello');
    expect(deepRedact(null)).toBe(null);
  });
});
