import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './rrf';

describe('reciprocalRankFusion', () => {
  it('scores 1/(k+rank) and sums across lists', () => {
    const out = reciprocalRankFusion(
      [
        { leg: 'fts', ids: ['a', 'b'] },
        { leg: 'vec', ids: ['b', 'c'] },
      ],
      60,
    );
    expect(out.map(o => o.id)).toEqual(['b', 'a', 'c']);
    expect(out[0]!.score).toBeCloseTo(1 / 62 + 1 / 61, 10);
    expect(out[0]!.legs).toEqual(['fts', 'vec']);
  });

  it('rewards agreement across query variants of the same leg', () => {
    const out = reciprocalRankFusion([
      { leg: 'vec', ids: ['x', 'y'] },
      { leg: 'vec', ids: ['y', 'x'] },
      { leg: 'vec', ids: ['y', 'z'] },
    ]);
    expect(out[0]!.id).toBe('y');
    expect(out[0]!.legs).toEqual(['vec']);
  });

  it('applies weights and handles empty input', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    const out = reciprocalRankFusion([
      { leg: 'a', ids: ['p'], weight: 0.5 },
      { leg: 'b', ids: ['q'], weight: 2 },
    ]);
    expect(out[0]!.id).toBe('q');
  });
});
