import type { TFunction } from 'i18next';

export function awardTitle(t: TFunction, id: string, dish?: string): string {
  return t(`awards.${id}.title` as 'awards.big_spender.title', { dish: dish ?? '' });
}

export function awardDescription(t: TFunction, id: string, dish?: string): string {
  return t(`awards.${id}.desc` as 'awards.big_spender.desc', { dish: dish ?? '' });
}
