import type { Page, Route } from '@playwright/test';

/** A tiny valid PNG (8×8, white) for upload tests. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4//8/AxbAOFQFAKmhP8FTnxadAAAAAElFTkSuQmCC',
  'base64',
);

export function apiError(route: Route, status: number, code: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code, message: 'mocked' } }),
  });
}

interface AssignBody {
  utterance: string;
  items: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
}

/**
 * A stand-in for /api/assign: understands "<Name> had the <item>" and
 * "<A> and <B> shared the <item>" well enough for the UI tests.
 */
export async function mockAssign(page: Page) {
  await page.route('**/api/assign', async (route) => {
    const body = route.request().postDataJSON() as AssignBody;
    const text = body.utterance.toLowerCase();
    const person = (name: string) =>
      body.people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const item = (word: string) => body.items.find((i) => i.name.toLowerCase().includes(word));
    const assignments: Array<{
      itemId: string;
      shares: Array<{ personId: string; weight: number }>;
    }> = [];
    for (const clause of text.split(/,| and (?=\p{L}+ had)/u)) {
      const shared = /(\p{L}+) and (\p{L}+) shared the (\p{L}+)/u.exec(clause);
      const single = /(\p{L}+) had the (\p{L}+)/u.exec(clause);
      if (shared) {
        const it = item(shared[3]!.replace(/s$/, ''));
        const a = person(shared[1]!);
        const b = person(shared[2]!);
        if (it && a && b)
          assignments.push({
            itemId: it.id,
            shares: [
              { personId: a.id, weight: 1 },
              { personId: b.id, weight: 1 },
            ],
          });
      } else if (single) {
        const it = item(single[2]!);
        const p = person(single[1]!);
        if (it && p) assignments.push({ itemId: it.id, shares: [{ personId: p.id, weight: 1 }] });
      }
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        assignments,
        unmatched: [],
        notes: [
          assignments
            .map((a) => {
              const names = a.shares.map((s) => body.people.find((p) => p.id === s.personId)!.name);
              const dish = body.items.find((i) => i.id === a.itemId)!.name;
              return `${names.join(' and ')} ${names.length > 1 ? 'share' : 'gets'} the ${dish}.`;
            })
            .join(' '),
        ],
      }),
    });
  });
}

/** Home → sample grill receipt → demo crew → assign screen. */
export async function startSampleToAssign(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Try a sample receipt/ }).click();
  await page.getByRole('button', { name: /Ember & Moon Grill/ }).click();
  await page.getByRole('button', { name: 'Next: who was there?' }).click();
  await page.getByRole('button', { name: 'Add the demo crew' }).click();
  await page.getByRole('button', { name: 'Next: who had what?' }).click();
}

/** From the assign screen: split anything left equally and open the results. */
export async function finishToResults(page: Page) {
  await page.getByRole('button', { name: 'Next: extras' }).click();
  const splitRest = page.getByRole('button', { name: 'Split them equally' });
  if (await splitRest.isVisible().catch(() => false)) await splitRest.click();
  await page.getByRole('button', { name: 'See the results' }).click();
}

/** Reads a money amount such as "£118.29" into pence. */
export function pence(text: string): number {
  return Math.round(Number(text.replace(/[^\d.]/g, '')) * 100);
}
