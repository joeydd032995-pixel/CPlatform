// Vercel's Node runtime resolves `import`s of cross-workspace packages
// (@cplatform/shared, @cplatform/games, @cplatform/core-rng) the way plain
// Node does: via `node_modules`, reading each package.json's `main` field.
// Those packages' `main` points straight at raw TypeScript source (`src/
// index.ts`) -- that only works locally/in tests because `tsx`/`vitest`
// transpile `.ts` on the fly regardless of where the file lives. Vercel's
// builder transpiles apps/server's OWN files to `.js`, but treats
// node_modules-resolved packages as external and copies them as-is,
// leaving raw `.ts` files that plain Node can't load
// (`ERR_MODULE_NOT_FOUND`). This script fixes that for the Vercel deploy
// only, without touching local dev/tests or any package's `main` field in
// the committed repo: it bundles api/index.ts's whole workspace-package
// dependency graph into one self-contained file with esbuild (which,
// unlike Node, resolves and transpiles TypeScript directly) and overwrites
// api/index.ts's CONTENT with that bundle. This only ever runs inside
// Vercel's ephemeral build checkout -- it never touches the actual git
// history.
//
// Important: this rewrites the file's content in place rather than
// deleting it and writing api/index.js. Vercel scans `api/` for functions
// from the checked-out filesystem BEFORE running this build command, then
// tries to actually build the function it found (api/index.ts) AFTER this
// script runs -- deleting/renaming it out from under that second step
// fails with "File not found: api/index.ts". Keeping the same filename
// (now containing plain JS, which is always valid TypeScript too) means
// Vercel's own per-function build step still finds exactly the file it
// expects, just with different contents.
//
// @cplatform/db is the one exception: createApp.ts imports it via a
// *non-literal* dynamic `import(dbModuleSpecifier)` specifically so esbuild
// (like tsc) can't statically resolve/bundle it -- inlining Prisma's
// generated client (native query-engine binaries) would break it. So it
// stays a real runtime import, which means it hits this exact same
// raw-TypeScript-`main` problem on its own; this script separately builds
// @cplatform/db to JS and repoints its `main`/`types` at that build output
// (again, only inside this ephemeral checkout).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as esbuild from 'esbuild';

const BUNDLE_MARKER = '// __CPLATFORM_VERCEL_BUNDLE__';

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(serverDir, '../..');
const dbDir = path.join(repoRoot, 'packages/db');
const entry = path.join(serverDir, 'api/index.ts');

function run(cmd, cwd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Vercel appears to invoke `vercel-build` more than once for a single
// deployment. Since this script overwrites api/index.ts's content, detect
// that (via a marker comment) and no-op on the second invocation rather
// than re-bundling already-bundled code.
if (readFileSync(entry, 'utf8').startsWith(BUNDLE_MARKER)) {
  console.log('api/index.ts already bundled by a prior invocation -- skipping.');
  process.exit(0);
}

// 1. Generate the Prisma client (network access to the engine-binary CDN,
// same as before -- unchanged step).
run('npm run prisma:generate', dbDir);

// 2. Compile @cplatform/db to JS (it already has a working `tsc` build
// script) and repoint its `main`/`types` at that output so the dynamic
// `import('@cplatform/db')` in createApp.ts resolves to compiled JS at
// runtime instead of raw TypeScript. Only mutates this ephemeral checkout.
run('npm run build', dbDir);
const dbPkgPath = path.join(dbDir, 'package.json');
const dbPkg = JSON.parse(readFileSync(dbPkgPath, 'utf8'));
dbPkg.main = './dist/client.js';
dbPkg.types = './dist/client.d.ts';
writeFileSync(dbPkgPath, JSON.stringify(dbPkg, null, 2) + '\n');

// 3. Bundle api/index.ts and everything under apps/server/src, inlining
// only the workspace packages that have the raw-TypeScript-`main` problem
// (@cplatform/shared, @cplatform/games, @cplatform/core-rng). Third-party
// npm dependencies are marked external and left as real node_modules
// imports/requires -- they're already valid compiled JS with correct
// package.json `main`s (no resolution problem to fix), and bundling them
// anyway introduces new incompatibilities instead (e.g. esbuild's ESM
// output can't support pino's dynamic `require("node:os")`-style lazy
// loads). @cplatform/db is external for the separate reason in the comment
// above: its dynamic non-literal import must stay a genuine runtime import.
const outfile = path.join(serverDir, 'api/index.bundle.js');
await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['@cplatform/db', 'express', 'ioredis', 'helmet', 'cors', 'pino-http', 'pino', 'zod'],
  logLevel: 'info',
});

// 4. Overwrite api/index.ts's content with the bundle (same filename/
// extension, so Vercel's own function-detection manifest still matches).
writeFileSync(entry, `${BUNDLE_MARKER}\n${readFileSync(outfile, 'utf8')}`);
rmSync(outfile);

console.log('Bundled api/index.ts in place for Vercel deployment.');
