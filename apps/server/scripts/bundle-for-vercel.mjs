// Vercel's Node runtime resolves `import`s of cross-workspace packages
// (@cplatform/shared, @cplatform/games, @cplatform/core-rng, @cplatform/db)
// the way plain Node does: via `node_modules`, reading each package.json's
// `main` field. Those packages' `main` all point straight at raw
// TypeScript source (`src/index.ts` or `src/client.ts`) -- that only works
// locally/in tests because `tsx`/`vitest` transpile `.ts` on the fly
// regardless of where a file lives. Vercel's builder transpiles (and
// type-checks!) apps/server's OWN `api/index.ts`/`src/**` files, but
// resolves cross-workspace packages the way plain Node does, finds a `.ts`
// file, and plain Node can't load that (`ERR_MODULE_NOT_FOUND`).
//
// An earlier version of this script tried bundling api/index.ts (with
// esbuild) into one self-contained file to route around this. That broke
// two different ways against Vercel's actual build lifecycle: (1) Vercel
// scans `api/` for functions from the checked-out filesystem BEFORE
// running this build command, then tries to build the exact file it found
// (api/index.ts) AFTER -- deleting/renaming it out from under that second
// pass fails with "File not found"; (2) even overwriting api/index.ts's
// *content* in place (same filename) still failed, because Vercel's
// per-function build step runs a real `tsc` type-check over it, and
// esbuild's bundled output -- while perfectly valid JS -- doesn't survive
// strict TypeScript checking (private-field lowering, etc. produce
// type errors tsc rejects even though the code runs fine).
//
// This version is simpler and doesn't touch api/index.ts (or anything
// under apps/server/src) at all, so Vercel's own type-check of those files
// keeps passing exactly as it always has. It instead fixes the actual
// root cause at the source: for each workspace package apps/server
// depends on, compile it to real JS (each already has a working `tsc`
// build script) and repoint its `main`/`types` at that output --
// mirroring what a normal monorepo consumer would resolve. This only
// mutates package.json files inside this ephemeral Vercel build checkout,
// never the committed repo, so local dev (tsx) and tests (vitest) --
// which transpile source `.ts` directly regardless of `main` -- are
// completely unaffected.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(serverDir, '../..');

function run(cmd, cwd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function buildAndRepoint(pkgRelDir, mainRelPath, typesRelPath) {
  const dir = path.join(repoRoot, pkgRelDir);
  run('npm run build', dir);
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.main = mainRelPath;
  pkg.types = typesRelPath;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// Prisma client generation needs network access to the engine-binary CDN --
// unchanged from before this script existed.
run('npm run prisma:generate', path.join(repoRoot, 'packages/db'));

buildAndRepoint('packages/shared', './dist/index.js', './dist/index.d.ts');
buildAndRepoint('packages/core-rng', './dist/index.js', './dist/index.d.ts');
buildAndRepoint('packages/games', './dist/index.js', './dist/index.d.ts');
buildAndRepoint('packages/db', './dist/client.js', './dist/client.d.ts');

console.log('Compiled workspace packages to dist/ and repointed main/types for Vercel deployment.');
