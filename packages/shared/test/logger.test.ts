import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';

// Re-derive the same redact config logger.ts uses, but against a capturable
// stream, so we can assert on the actual serialized output rather than
// trusting pino's redact option works as configured.
const REDACT_PATHS = [
  'serverSeed',
  '*.serverSeed',
  '*.*.serverSeed',
  'activeServerSeed',
  '*.activeServerSeed',
  'req.body.serverSeed',
  'req.headers.authorization',
  'req.headers.cookie',
];

function makeCapturingLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const testLogger = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { testLogger, lines };
}

describe('logger redaction', () => {
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

  it('does not redact unrelated fields', () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ game: 'mines', betAmount: 10 }, 'test log');
    expect(lines[0]).toContain('mines');
    expect(lines[0]).toContain('10');
  });
});
