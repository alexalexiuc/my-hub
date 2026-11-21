import { describe, expect, it } from 'vitest';
import { DEFAULT_RESOLVE_CONFIG, decide, scaleCosine, type Candidate } from './resolve';
import { buildTsQuery } from './search';

const cand = (path: string, score: number, exact = false): Candidate => ({
  path,
  title: path,
  category: 'x',
  score,
  trigram: score,
  cosine: 0,
  exact,
});

describe('decide', () => {
  it('creates a new note when nothing reaches the threshold', () => {
    expect(decide([cand('a', 0.3)], DEFAULT_RESOLVE_CONFIG).kind).toBe('none');
    expect(decide([], DEFAULT_RESOLVE_CONFIG).kind).toBe('none');
  });

  it('matches a single clear candidate', () => {
    const r = decide([cand('a', 0.8), cand('b', 0.4)], DEFAULT_RESOLVE_CONFIG);
    expect(r).toMatchObject({ kind: 'match', candidate: { path: 'a' } });
  });

  it('is ambiguous when two candidates are close above the threshold', () => {
    const r = decide([cand('a', 0.72), cand('b', 0.7)], DEFAULT_RESOLVE_CONFIG);
    expect(r.kind).toBe('ambiguous');
  });

  it('is not ambiguous when only the top one is an exact name/alias match', () => {
    expect(decide([cand('a', 1, true), cand('b', 0.98)], DEFAULT_RESOLVE_CONFIG).kind).toBe('match');
  });

  it('is ambiguous when several notes match the name exactly', () => {
    expect(decide([cand('a', 1, true), cand('b', 1, true)], DEFAULT_RESOLVE_CONFIG).kind).toBe('ambiguous');
  });

  it('prefers the clearly better of two matches', () => {
    expect(decide([cand('a', 0.9), cand('b', 0.65)], DEFAULT_RESOLVE_CONFIG).kind).toBe('match');
  });
});

describe('scaleCosine', () => {
  it('maps cosine above the floor onto 0..1', () => {
    expect(scaleCosine(0.8, 0.8)).toBe(0);
    expect(scaleCosine(0.9, 0.8)).toBeCloseTo(0.5);
    expect(scaleCosine(1, 0.8)).toBe(1);
    expect(scaleCosine(0.5, 0.8)).toBe(0);
  });
});

describe('buildTsQuery', () => {
  it('ORs words, prefixes longer ones, drops short ones and accents', () => {
    expect(buildTsQuery('Who washed our rugs?')).toBe('who | washed:* | our | rugs:*');
    expect(buildTsQuery('curățare a covoare')).toBe('curatare:* | covoare:*');
    expect(buildTsQuery('?? !!')).toBe('');
  });
});
