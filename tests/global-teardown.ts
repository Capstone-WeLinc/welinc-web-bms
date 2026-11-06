import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default async function globalTeardown() {
  execFileSync(process.execPath, [resolve(root, 'scripts/e2e-cleanup.mjs'), '--clean'], {
    cwd: root,
    stdio: 'inherit',
  });
}
