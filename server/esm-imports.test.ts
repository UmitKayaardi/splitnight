// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Vercel runs the functions as native Node ES modules, which need explicit file
 * extensions on relative imports. A missing ".js" only fails in production, so check here.
 */
const ROOT = resolve(__dirname, '..');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('serverless function imports', () => {
  const files = ['api', 'server', 'shared'].flatMap((d) => tsFiles(join(ROOT, d)));

  it.each(files.map((f) => [f.slice(ROOT.length + 1)]))('%s uses .js on relative imports', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    const bad = [...source.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)]
      .map((m) => m[1]!)
      .filter((spec) => !spec.endsWith('.js') && !spec.endsWith('.json'));
    expect(bad).toEqual([]);
  });
});
