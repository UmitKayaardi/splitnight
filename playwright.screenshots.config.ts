import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/** Generates the README screenshots: `npm run screenshots` (after `npm run build`). */
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ['**/screenshots.spec.ts'],
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'], deviceScaleFactor: 2 } }],
});
