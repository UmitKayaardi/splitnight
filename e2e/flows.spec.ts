import { expect, test } from '@playwright/test';
import {
  apiError,
  finishToResults,
  mockAssign,
  pence,
  startSampleToAssign,
  TINY_PNG,
} from './helpers';

const problems = new WeakMap<object, string[]>();

test.beforeEach(async ({ page }) => {
  const seen: string[] = [];
  problems.set(page, seen);
  page.on('pageerror', (error) => seen.push(`page error: ${error.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text()))
      seen.push(msg.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Any API call a test does not mock explicitly fails loudly.
  await page.route('**/api/**', (route) => apiError(route, 500, 'UPSTREAM'));
});

test.afterEach(async ({ page }) => {
  // The preview server sends the production CSP, so this also catches policy violations.
  expect(problems.get(page) ?? []).toEqual([]);
});

test('sample receipt: say who had what, split the rest, see totals that add up', async ({
  page,
}) => {
  await mockAssign(page);
  await startSampleToAssign(page);

  await page
    .getByRole('button', { name: /Ahmet had the salad, Ayşe and Can shared the kebabs/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Here’s what I understood' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Applied. Say or type another sentence')).toBeVisible();
  await expect(page.getByText('8 items left to assign')).toBeVisible();

  await finishToResults(page);
  await expect(page.getByRole('heading', { name: 'The damage' })).toBeVisible();
  await expect(page.getByText('£118.29').first()).toBeVisible();
  await expect(page.getByText('Everyone’s totals add up to £118.29.')).toBeVisible();

  const totals = await page.locator('main li button[aria-expanded] .tabular').allTextContents();
  expect(totals).toHaveLength(4);
  expect(totals.reduce((a, t) => a + pence(t), 0)).toBe(11829);
});

test('manual entry works with no AI at all', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Or type the items in yourself' }).click();
  await expect(page.getByRole('heading', { name: 'Enter the items' })).toBeVisible();

  for (const [name, price] of [
    ['Pizza', '12.50'],
    ['Wine', '20'],
  ]) {
    await page.getByLabel('Item name').last().fill(name!);
    await page.getByLabel('Price', { exact: true }).fill(price!);
    await page.getByRole('button', { name: 'Add item' }).click();
  }
  await page.getByRole('button', { name: 'Next: who was there?' }).click();
  for (const name of ['Mia', 'Leo']) {
    await page.getByPlaceholder('Type a name and press Enter').fill(name);
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: 'Next: who had what?' }).click();

  // Tap an item, then use the sheet instead of dragging.
  await page.getByRole('button', { name: /Wine/ }).click();
  await page.getByRole('button', { name: 'Everyone shared this' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Pizza/ }).click();
  await page.getByRole('checkbox', { name: /Mia/ }).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Everything is assigned')).toBeVisible();

  await finishToResults(page);
  await expect(page.getByRole('button', { name: 'Show breakdown for Mia' })).toContainText(
    '£22.50',
  );
  await expect(page.getByRole('button', { name: 'Show breakdown for Leo' })).toContainText(
    '£10.00',
  );
});

test('deleting an item can be undone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Try a sample receipt/ }).click();
  await page.getByRole('button', { name: /Hummingbird Café/ }).click();
  await expect(page.getByText('8 items')).toBeVisible();

  await page.getByRole('button', { name: 'Delete Carrot Cake' }).click();
  await expect(page.getByText('7 items')).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('8 items')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Carrot Cake' })).toBeVisible();

  // The global redo in the top bar brings the deletion back.
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByText('7 items')).toBeVisible();
});

test('Bill Roulette result can be applied and undone', async ({ page }) => {
  await startSampleToAssign(page);
  await finishToResults(page);
  const before = await page.getByRole('button', { name: 'Show breakdown for Ahmet' }).textContent();

  await page.getByRole('button', { name: 'Let fate decide 🎲' }).click();
  await expect(page.getByText('Just for fun — nobody is charged.')).toBeVisible();
  await page.getByRole('radio', { name: 'Dice' }).check({ force: true });
  await page.getByRole('button', { name: 'Let’s play' }).click();
  // Ties roll again, so keep rolling until fate has spoken.
  for (let i = 0; i < 10; i++) {
    if (await page.getByText(/Fate has spoken/).isVisible()) break;
    const roll = page.getByRole('button', { name: 'Roll the dice' });
    if (await roll.isEnabled().catch(() => false)) await roll.click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByText(/Fate has spoken/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Apply to the split' }).click();

  await expect(page.getByText(/Bill Roulette: .* covers the whole bill\./)).toBeVisible();
  const totals = await page.locator('main li button[aria-expanded] .tabular').allTextContents();
  expect(totals.filter((t) => pence(t) === 11829)).toHaveLength(1);
  expect(totals.filter((t) => pence(t) === 0)).toHaveLength(3);

  await page.getByRole('button', { name: 'Undo roulette' }).click();
  await expect(page.getByRole('button', { name: 'Show breakdown for Ahmet' })).toHaveText(before!);
});

test('language and theme can be switched and are remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');

  await page.getByRole('button', { name: /^Language/ }).click();
  await page.getByRole('radio', { name: 'Türkçe' }).click();
  await expect(page.getByRole('button', { name: /Örnek fişle dene/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');

  const html = page.locator('html');
  await page.getByRole('button', { name: /^Tema/ }).click(); // system → light
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: /^Tema/ }).click(); // light → dark
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(page.getByRole('button', { name: /Örnek fişle dene/ })).toBeVisible();
  await expect(html).toHaveClass(/dark/);
});

test('a busy AI during scanning offers useful next steps', async ({ page }) => {
  await page.route('**/api/parse-receipt', (route) => apiError(route, 429, 'RATE_LIMITED'));
  await page.goto('/');
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(page.getByRole('alert')).toHaveText('The AI is a bit busy');
  await expect(page.getByRole('button', { name: 'Try another photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a sample receipt' }).click();
  await expect(page.getByRole('heading', { name: 'Check the items' })).toBeVisible();
});

test('an unreadable photo can fall back to manual entry', async ({ page }) => {
  await page.route('**/api/parse-receipt', (route) => apiError(route, 422, 'UNREADABLE'));
  await page.goto('/');
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(page.getByRole('alert')).toHaveText('We couldn’t read that receipt');
  await page.getByRole('button', { name: 'Enter items manually' }).click();
  await expect(page.getByRole('heading', { name: 'Enter the items' })).toBeVisible();
});

test('a scanned receipt opens for review', async ({ page }) => {
  await page.route('**/api/parse-receipt', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        merchant: 'Test Diner',
        currency: 'GBP',
        items: [
          {
            id: 'r1',
            name: 'Burger',
            quantity: 1,
            unitPriceMinor: 1200,
            lineTotalMinor: 1200,
            category: 'main',
            confidence: 0.95,
          },
          {
            id: 'r2',
            name: 'Shake',
            quantity: 2,
            unitPriceMinor: 450,
            lineTotalMinor: 900,
            category: 'drink',
            confidence: 0.4,
          },
        ],
        taxLines: [],
        discounts: [],
        totalMinor: 2500,
        warnings: ['blurry'],
      }),
    }),
  );
  await page.goto('/');
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(page.getByText('Test Diner')).toBeVisible();
  await expect(page.getByText('Check this')).toBeVisible();
  await expect(page.getByText('The photo was a little blurry')).toBeVisible();
  await expect(page.getByText('Totals don’t match — check the items')).toBeVisible();
});

test('when the AI is unavailable, assigning by hand still works', async ({ page }) => {
  await page.route('**/api/assign', (route) => apiError(route, 503, 'NOT_CONFIGURED'));
  await startSampleToAssign(page);
  await page.getByRole('textbox', { name: 'Describe who had what' }).fill('Sam had the cola');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/The AI helper isn’t available right now/)).toBeVisible();
});

test('finished nights appear in Recent nights', async ({ page }) => {
  await startSampleToAssign(page);
  await finishToResults(page);
  await page.getByRole('button', { name: 'Start a new bill' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start a new bill' }).click();
  await page.getByRole('button', { name: 'Recent nights' }).click();
  await expect(page.getByText('4 friends · £118.29')).toBeVisible();
});

test('the confetti celebration runs under the production CSP', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startSampleToAssign(page);
  await finishToResults(page);
  await expect(page.getByRole('heading', { name: 'The damage' })).toBeVisible();
  // canvas-confetti draws on a canvas it adds to the page (and may use a blob: worker).
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 5_000 });
  await page.waitForTimeout(1_000);
});
