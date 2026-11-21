import { l2Normalize, type EmbeddingProvider } from './types';

/** Embeddings from an Ollama server (`POST /api/embed`), e.g. `bge-m3` (1024 dims) or `embeddinggemma` (768). */
export class OllamaProvider implements EmbeddingProvider {
  readonly name = 'ollama';

  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    readonly dimensions: number,
  ) {}

  async ready(): Promise<void> {
    await this.embedPassages(['warmup']);
  }

  embedPassages(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  embedQueries(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  private async embed(input: string[]): Promise<number[][]> {
    if (input.length === 0) return [];
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, input }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
    const { embeddings } = (await res.json()) as { embeddings: number[][] };
    return embeddings.map(l2Normalize);
  }
}
