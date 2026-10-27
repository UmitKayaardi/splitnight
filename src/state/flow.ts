import { unassignedItems } from './derive';
import type { BillData, FlowStep } from './types';

/** Whether a step of the flow can be opened yet (used by the step indicator). */
export function canEnter(step: FlowStep, data: BillData): boolean {
  const hasItems = data.items.length > 0;
  const hasPeople = data.people.length >= 2;
  switch (step) {
    case 'review':
      return true;
    case 'people':
      return hasItems;
    case 'assign':
    case 'extras':
      return hasItems && hasPeople;
    case 'results':
      return hasItems && hasPeople && unassignedItems(data).length === 0;
  }
}
