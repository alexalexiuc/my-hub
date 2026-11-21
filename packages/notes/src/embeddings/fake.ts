import { createHash } from 'node:crypto';
import { l2Normalize, type EmbeddingProvider } from './types';

/**
 * Deterministic hash-based vectors from character trigrams and words, for tests, CI and environments without
 * model access. Similar spellings land near each other, but there is NO semantic or cross-language
 * understanding: relevance numbers measured with this provider say nothing about the real model.
 */
export class FakeProvider implements EmbeddingProvider {
  readonly name = 'fake';
  readonly model = 'fake-trigram-hash';

  constructor(readonly dimensions: number = 384) {}

  async ready(): Promise<void> {}

  async embedPassages(texts: string[]): Promise<number[][]> {
    return texts.map(t => this.embed(t));
  }

  async embedQueries(texts: string[]): Promise<number[][]> {
    return texts.map(t => this.embed(t));
  }

  private embed(text: string): number[] {
    const v = new Array<number>(this.dimensions).fill(0);
    const clean = text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    const add = (token: string, weight: number) => {
      const h = createHash('md5').update(token).digest();
      const idx = h.readUInt32LE(0) % this.dimensions;
      v[idx]! += (h[4]! & 1 ? 1 : -1) * weight;
    };
    for (const word of clean.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
      add(`w:${word}`, 1);
      const padded = `  ${word} `;
      for (let i = 0; i + 3 <= padded.length; i++) add(`t:${padded.slice(i, i + 3)}`, 0.5);
    }
    return l2Normalize(v);
  }
}
