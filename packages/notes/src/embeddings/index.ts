import { notesEnv } from '../config/env';
import { E5LocalProvider } from './e5';
import { FakeProvider } from './fake';
import type { EmbeddingProvider } from './types';

export { E5LocalProvider, FakeProvider };
export type { EmbeddingProvider };
export { l2Normalize } from './types';

/** Builds the provider selected by `EMBEDDINGS_PROVIDER` (`e5` | `fake`). */
export function createEmbeddingProvider(kind: string = notesEnv.EMBEDDINGS_PROVIDER): EmbeddingProvider {
  switch (kind) {
    case 'fake':
      return new FakeProvider();
    case 'e5':
      return new E5LocalProvider({
        cacheDir: notesEnv.EMBEDDINGS_CACHE_DIR,
        localModelPath: notesEnv.EMBEDDINGS_LOCAL_MODEL_PATH || undefined,
      });
    default:
      throw new Error(`Unknown EMBEDDINGS_PROVIDER "${kind}" (expected e5 or fake)`);
  }
}
