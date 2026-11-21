export { notesEnv } from './config/env';
export { createDb, ensureSchema, toVectorLiteral, type Db } from './db';
export {
  E5LocalProvider,
  FakeProvider,
  OllamaProvider,
  createEmbeddingProvider,
  l2Normalize,
  type EmbeddingProvider,
} from './embeddings';
export { Indexer, namesText } from './indexer';
export * from './markdown';
export {
  DEFAULT_RESOLVE_CONFIG,
  decide,
  findCandidates,
  scaleCosine,
  type Candidate,
  type ResolveConfig,
  type Resolution,
} from './resolve';
export { DEFAULT_RRF_K, reciprocalRankFusion, type FusedScore, type Ranking } from './rrf';
export {
  SEARCH_LEGS,
  buildTsQuery,
  searchNotes,
  type SearchHit,
  type SearchLeg,
  type SearchOptions,
  type SearchResult,
} from './search';
export {
  NotesRuntime,
  NotesService,
  createNotesRuntime,
  type NoteListItem,
  type NotesRuntimeConfig,
  type RecentEntry,
  type RememberInput,
  type RememberResult,
} from './service';
export { normalizeForMatch, slugify, toAscii } from './slug';
export { NoteStore, assertNotePath } from './store';
