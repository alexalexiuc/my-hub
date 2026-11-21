import { describe, expect, it } from 'vitest';
import { buildTsQuery } from './search';

describe('buildTsQuery', () => {
  it('ORs words, prefixes longer ones, drops short ones and accents', () => {
    expect(buildTsQuery('Who washed our rugs?')).toBe('who | washed:* | our | rugs:*');
    expect(buildTsQuery('curățare a covoare')).toBe('curatare:* | covoare:*');
    expect(buildTsQuery('?? !!')).toBe('');
  });
});
