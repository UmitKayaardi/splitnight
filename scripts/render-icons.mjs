// Renders the PWA icons (PNG) from public/favicon.svg with Playwright's Chromium.
// Run with `npm run icons:render` after changing the logo.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
mkdirSync(resolve(root, 'public/icons'), { recursive: true });

// Maskable icons need the artwork inside the central 80% "safe zone" on a full-bleed background.
const page = (
  size,
  maskable,
) => `<!doctype html><html><body style="margin:0;background:${maskable ? '#241a5c' : 'transparent'}">
<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
  <div style="width:${maskable ? size * 0.72 : size}px;height:${maskable ? size * 0.72 : size}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
</div></body></html>`;

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, maskable: false },
  { file: 'public/icons/icon-512.png', size: 512, maskable: false },
  { file: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
  // iOS ignores transparency and adds its own rounding, so use the full-bleed version.
  { file: 'public/apple-touch-icon.png', size: 180, maskable: true },
];

const browser = await chromium.launch();
for (const { file, size, maskable } of targets) {
  const tab = await browser.newPage({ viewport: { width: size, height: size } });
  await tab.setContent(page(size, maskable));
  await tab.screenshot({ path: resolve(root, file), omitBackground: !maskable });
  await tab.close();
  console.log(`wrote ${file}`);
}
await browser.close();
