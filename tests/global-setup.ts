import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default async function globalSetup() {
  execFileSync(process.execPath, [resolve(root, 'scripts/e2e-cleanup.mjs'), '--begin'], {
    cwd: root,
    stdio: 'inherit',
  });
}
