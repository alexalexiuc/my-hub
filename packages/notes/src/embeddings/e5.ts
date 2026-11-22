import { l2Normalize, type EmbeddingProvider } from './types';

const E5_MODEL = 'Xenova/multilingual-e5-small';
const E5_DIMENSIONS = 384;
const BATCH_SIZE = 32;

export interface E5Options {
  cacheDir?: string;
  /** Directory with pre-seeded weights; disables remote downloads when set. */
  localModelPath?: string;
}

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

/**
 * multilingual-e5-small (int8 ONNX) run in-process through Transformers.js.
 * E5 expects `passage: ` / `query: ` prefixes, mean pooling and L2 normalisation.
 */
export class E5LocalProvider implements EmbeddingProvider {
  readonly name = 'e5';
  readonly model = E5_MODEL;
  readonly dimensions = E5_DIMENSIONS;
  private extractor: Promise<Extractor> | null = null;

  constructor(private readonly options: E5Options = {}) {}

  /** Loads the pipeline once; concurrent callers share the same promise. */
  ready(): Promise<void> {
    this.extractor ??= this.load().catch((err: unknown) => {
      this.extractor = null; // let the next call retry
      const cause = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not load embedding model ${this.model}: ${cause}. If this host cannot reach huggingface.co, ` +
          'pre-seed the weights and set EMBEDDINGS_LOCAL_MODEL_PATH (see packages/notes/README.md).',
      );
    });
    return this.extractor.then(() => undefined);
  }

  embedPassages(texts: string[]): Promise<number[][]> {
    return this.embed(texts.map(t => `passage: ${t}`));
  }

  embedQueries(texts: string[]): Promise<number[][]> {
    return this.embed(texts.map(t => `query: ${t}`));
  }

  private async load(): Promise<Extractor> {
    const { pipeline, env } = await import('@huggingface/transformers');
    if (this.options.cacheDir) env.cacheDir = this.options.cacheDir;
    if (this.options.localModelPath) {
      env.localModelPath = this.options.localModelPath;
      env.allowRemoteModels = false;
    }
    const extractor = await pipeline('feature-extraction', this.model, { dtype: 'q8' });
    return extractor as unknown as Extractor;
  }

  private async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    await this.ready();
    const extractor = await this.extractor!;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const result = await extractor(texts.slice(i, i + BATCH_SIZE), { pooling: 'mean', normalize: true });
      out.push(...result.tolist().map(l2Normalize));
    }
    return out;
  }
}
