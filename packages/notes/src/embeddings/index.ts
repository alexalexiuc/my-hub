import { notesEnv } from '../config/env';
import { E5LocalProvider, E5_DEFAULT_MODEL } from './e5';
import { FakeProvider } from './fake';
import { OllamaProvider } from './ollama';
import type { EmbeddingProvider } from './types';

export { E5LocalProvider, FakeProvider, OllamaProvider };
export type { EmbeddingProvider };
export { l2Normalize } from './types';

/** Builds the provider selected by `EMBEDDINGS_PROVIDER` (`e5` | `ollama` | `fake`). */
export function createEmbeddingProvider(kind: string = notesEnv.EMBEDDINGS_PROVIDER): EmbeddingProvider {
  switch (kind) {
    case 'fake':
      return new FakeProvider(notesEnv.EMBEDDINGS_DIMENSIONS || 384);
    case 'ollama': {
      const dims = notesEnv.EMBEDDINGS_DIMENSIONS;
      if (!dims) throw new Error('EMBEDDINGS_DIMENSIONS is required for the ollama provider (bge-m3: 1024).');
      return new OllamaProvider(notesEnv.OLLAMA_URL, notesEnv.EMBEDDINGS_MODEL || 'bge-m3', dims);
    }
    case 'e5':
      return new E5LocalProvider({
        model: notesEnv.EMBEDDINGS_MODEL || E5_DEFAULT_MODEL,
        cacheDir: notesEnv.EMBEDDINGS_CACHE_DIR,
        localModelPath: notesEnv.EMBEDDINGS_LOCAL_MODEL_PATH || undefined,
      });
    default:
      throw new Error(`Unknown EMBEDDINGS_PROVIDER "${kind}" (expected e5, ollama or fake)`);
  }
}
