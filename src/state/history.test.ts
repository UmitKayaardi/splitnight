import { hallOfFame, useHistory, type Night } from './history';

const night = (id: string, loser: string | undefined, bigSpender: string): Night => ({
  id,
  date: '2026-10-27T20:00:00.000Z',
  totalMinor: 1000,
  currency: 'GBP',
  friends: 3,
  names: ['Ahmet', 'Ayşe', 'Can'],
  awards: [{ id: 'big_spender', personName: bigSpender }],
  ...(loser ? { rouletteLoser: loser } : {}),
});

describe('recent nights', () => {
  beforeEach(() => useHistory.getState().clear());

  it('updates a night saved twice instead of duplicating it', () => {
    useHistory.getState().save(night('a', undefined, 'Can'));
    useHistory.getState().save({ ...night('a', 'Can', 'Can'), totalMinor: 2000 });
    expect(useHistory.getState().nights).toHaveLength(1);
    expect(useHistory.getState().nights[0]!.totalMinor).toBe(2000);
  });

  it('keeps only the latest 20 nights', () => {
    for (let i = 0; i < 25; i++) useHistory.getState().save(night(`n${i}`, undefined, 'Can'));
    expect(useHistory.getState().nights).toHaveLength(20);
    expect(useHistory.getState().nights[0]!.id).toBe('n24');
  });

  it('builds the Hall of Fame, matching names regardless of case', () => {
    const fame = hallOfFame([
      night('1', 'Can', 'Ayşe'),
      night('2', 'can', 'Ayşe'),
      night('3', 'Ahmet', 'Can'),
      night('4', undefined, 'Ayşe'),
    ]);
    expect(fame.mostPicked[0]).toEqual({ name: 'Can', count: 2 });
    expect(fame.mostBigSpender[0]).toEqual({ name: 'Ayşe', count: 3 });
  });
});
