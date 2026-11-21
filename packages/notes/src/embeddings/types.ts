/** Turns text into fixed-size, L2-normalised vectors. Passages (stored text) and queries are embedded differently. */
export interface EmbeddingProvider {
  /** `e5`, `ollama` or `fake`. Recorded in benchmark output. */
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  /** Loads the model (idempotent). Resolves once the first embedding can be produced. */
  ready(): Promise<void>;
  embedPassages(texts: string[]): Promise<number[][]>;
  embedQueries(texts: string[]): Promise<number[][]>;
}

/** Scales a vector to unit length (cosine distance then equals 1 − dot product). */
export function l2Normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map(x => x / norm);
}
