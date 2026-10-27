/**
 * Every user change to the bill goes through here, as one undoable commit.
 */
import type { Category, ProposedAssignment } from '../../shared/schemas';
import { applyProposal } from '../lib/assign/applyProposal';
import { newId } from '../lib/ids';
import { allocate, type RouletteOutcome, type Share } from '../lib/money';
import { normaliseName, pickColor, uniqueName } from '../lib/people';
import { useBill } from './bill';
import { unassignedItems } from './derive';
import type { BillData, BillItem, ExtrasSettings } from './types';

const commit = (recipe: (draft: BillData) => void) => useBill.getState().commit(recipe);

export const MAX_PEOPLE = 30;

export function addItem(
  name: string,
  priceMinor: number,
  quantity = 1,
  category: Category = 'other',
) {
  const id = newId('i');
  commit((d) => {
    d.items.push({
      id,
      name: name.trim().slice(0, 80),
      quantity,
      unitPriceMinor: priceMinor,
      lineTotalMinor: Math.round(priceMinor * quantity),
      category,
      confidence: 1,
      custom: true,
    });
  });
  return id;
}

export function updateItem(
  id: string,
  patch: Partial<Pick<BillItem, 'name' | 'quantity' | 'unitPriceMinor' | 'lineTotalMinor'>>,
) {
  commit((d) => {
    const item = d.items.find((i) => i.id === id);
    if (!item) return;
    if (patch.name !== undefined) item.name = patch.name.trim().slice(0, 80) || item.name;
    if (patch.quantity !== undefined || patch.unitPriceMinor !== undefined) {
      item.quantity = patch.quantity ?? item.quantity;
      item.unitPriceMinor = patch.unitPriceMinor ?? item.unitPriceMinor;
      item.lineTotalMinor = Math.round(item.unitPriceMinor * item.quantity);
    }
    if (patch.lineTotalMinor !== undefined) {
      item.lineTotalMinor = patch.lineTotalMinor;
      item.unitPriceMinor = Math.round(patch.lineTotalMinor / item.quantity);
    }
    // Once a person has checked a line it is no longer "unsure".
    item.confidence = 1;
  });
}

export function deleteItem(id: string) {
  commit((d) => {
    d.items = d.items.filter((i) => i.id !== id);
    delete d.assignments[id];
  });
}

/** "2 × Kebab" → two separate one-unit cards that can be assigned independently. */
export function splitItemIntoUnits(id: string) {
  commit((d) => {
    const index = d.items.findIndex((i) => i.id === id);
    const item = d.items[index];
    if (!item || !Number.isInteger(item.quantity) || item.quantity < 2) return;
    const parts = allocate(
      item.lineTotalMinor,
      Array.from({ length: item.quantity }, () => 1),
    );
    const shares = d.assignments[id];
    const units: BillItem[] = parts.map((lineTotalMinor, n) => ({
      ...item,
      id: n === 0 ? item.id : newId('i'),
      quantity: 1,
      unitPriceMinor: lineTotalMinor,
      lineTotalMinor,
    }));
    d.items.splice(index, 1, ...units);
    if (shares) units.forEach((u) => (d.assignments[u.id] = shares.map((s) => ({ ...s }))));
  });
}

export function addPerson(rawName: string): string | null {
  const { data } = useBill.getState();
  const name = normaliseName(rawName);
  if (!name || data.people.length >= MAX_PEOPLE) return null;
  const id = newId('p');
  commit((d) => {
    const unique = uniqueName(
      name,
      d.people.map((p) => p.name),
    );
    d.people.push({
      id,
      name: unique,
      color: pickColor(
        unique,
        d.people.map((p) => p.color),
      ),
    });
  });
  return id;
}

export function updatePerson(id: string, patch: { name?: string; emoji?: string | null }) {
  commit((d) => {
    const person = d.people.find((p) => p.id === id);
    if (!person) return;
    if (patch.name !== undefined) {
      const name = normaliseName(patch.name);
      if (name && name !== person.name) {
        person.name = uniqueName(
          name,
          d.people.filter((p) => p.id !== id).map((p) => p.name),
        );
      }
    }
    if (patch.emoji !== undefined) {
      if (patch.emoji) person.emoji = patch.emoji;
      else delete person.emoji;
    }
  });
}

export function removePerson(id: string) {
  commit((d) => {
    d.people = d.people.filter((p) => p.id !== id);
    for (const [itemId, shares] of Object.entries(d.assignments)) {
      const kept = shares.filter((s) => s.personId !== id);
      if (kept.length > 0) d.assignments[itemId] = kept;
      else delete d.assignments[itemId];
    }
    if (d.extras.roundingCoverId === id) d.extras.roundingCoverId = null;
    if (d.roulette?.loserId === id) d.roulette = null;
  });
}

export function setShares(itemId: string, shares: Share[]) {
  commit((d) => {
    const clean = shares.filter((s) => s.weight > 0);
    if (clean.length > 0) d.assignments[itemId] = clean;
    else delete d.assignments[itemId];
  });
}

/** Drag-and-drop: adds the person to whoever already shares the item. */
export function addPersonToItem(itemId: string, personId: string) {
  commit((d) => {
    const shares = d.assignments[itemId] ?? [];
    if (shares.some((s) => s.personId === personId)) return;
    d.assignments[itemId] = [...shares, { personId, weight: 1 }];
  });
}

export function everyoneSharesItem(itemId: string) {
  commit((d) => {
    d.assignments[itemId] = d.people.map((p) => ({ personId: p.id, weight: 1 }));
  });
}

export function applyAssignProposal(proposal: ProposedAssignment[]): string[] {
  let changed: string[] = [];
  commit((d) => {
    const result = applyProposal(d.items, d.assignments, proposal, () => newId('i'));
    d.items = result.items;
    d.assignments = result.assignments;
    changed = result.changedItemIds;
  });
  return changed;
}

export function splitRemainingEqually() {
  commit((d) => {
    for (const item of unassignedItems(d)) {
      d.assignments[item.id] = d.people.map((p) => ({ personId: p.id, weight: 1 }));
    }
  });
}

export function updateExtras(recipe: (extras: ExtrasSettings) => void) {
  commit((d) => recipe(d.extras));
}

export function setCurrency(currency: string) {
  commit((d) => {
    d.currency = currency;
  });
}

export function setRoulette(outcome: RouletteOutcome | null) {
  commit((d) => {
    d.roulette = outcome;
  });
}
