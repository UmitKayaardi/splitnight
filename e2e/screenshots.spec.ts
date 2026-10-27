import { expect, test, type Page } from '@playwright/test';
import { finishToResults, mockAssign, startSampleToAssign } from './helpers';

// Not part of the regular E2E run (see playwright.screenshots.config.ts).
const OUT = 'docs/screenshots';

async function shot(page: Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`README screenshots (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await mockAssign(page);

    await page.goto('/');
    await expect(page.getByRole('button', { name: /Try a sample receipt/ })).toBeVisible();
    await shot(page, `${scheme}-home`);

    await page.getByRole('button', { name: /Try a sample receipt/ }).click();
    await page.getByRole('button', { name: /Ember & Moon Grill/ }).click();
    await expect(page.getByRole('heading', { name: 'Check the items' })).toBeVisible();
    await shot(page, `${scheme}-review`);

    await startSampleToAssign(page);
    await page
      .getByRole('button', { name: /Ahmet had the salad, Ayşe and Can shared the kebabs/ })
      .click();
    await expect(page.getByRole('heading', { name: 'Here’s what I understood' })).toBeVisible();
    await shot(page, `${scheme}-assign`);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();

    await finishToResults(page);
    await expect(page.getByRole('heading', { name: 'The damage' })).toBeVisible();
    await page
      .getByRole('heading', { name: 'Titles of the night' })
      .scrollIntoViewIfNeeded()
      .catch(() => undefined);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `${scheme}-results`);

    await page.getByRole('button', { name: 'Let fate decide 🎲' }).click();
    await page.getByRole('button', { name: 'Let’s play' }).click();
    await page.getByRole('button', { name: 'Spin the wheel' }).click();
    await expect(page.getByText(/Fate has spoken/))
      .toBeVisible({ timeout: 10_000 })
      .catch(() => undefined);
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.getByRole('button', { name: 'Let’s play' }).click();
    await shot(page, `${scheme}-roulette`);
  });
}
