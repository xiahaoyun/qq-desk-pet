import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const assetsDir = path.join('dist', 'assets');
const entries = await readdir(assetsDir, { withFileTypes: true }).catch(() => []);

for (const entry of entries) {
  if (entry.isDirectory() && entry.name.endsWith('-frames')) {
    await rm(path.join(assetsDir, entry.name), { recursive: true, force: true });
  }
}
