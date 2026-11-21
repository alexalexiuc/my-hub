import { toVectorLiteral, type Db } from './db';
import type { EmbeddingProvider } from './embeddings';
import { normalizeForMatch, slugify } from './slug';

export interface Candidate {
  path: string;
  title: string;
  category: string;
  /** Combined 0–1 score used against the match threshold. */
  score: number;
  /** Trigram similarity of the subject against title + aliases. */
  trigram: number;
  /** Cosine similarity of the subject against the note's name embedding. */
  cosine: number;
  exact: boolean;
}

export interface ResolveConfig {
  /** Minimum combined score to count as the same subject. */
  threshold: number;
  /** Cosine below this contributes nothing (e5 similarities sit high even for unrelated text). */
  vectorFloor: number;
  /** When the top two matches are closer than this, the choice is ambiguous. */
  ambiguityMargin: number;
}

// Tuned on real e5 (multilingual-e5-small) with `pnpm --filter @my-hub/notes-bench bench:resolve`: e5 cosines bunch up in
// 0.82-0.93, so a match needs trigram >= 0.75 or cosine >= 0.9 (floor + threshold * (1 - floor)). See spec section 15.
export const DEFAULT_RESOLVE_CONFIG: ResolveConfig = { threshold: 0.75, vectorFloor: 0.6, ambiguityMargin: 0.05 };

/** Maps a cosine similarity to 0–1 above `floor`. */
export function scaleCosine(cosine: number, floor: number): number {
  if (floor >= 1) return 0;
  return Math.min(1, Math.max(0, (cosine - floor) / (1 - floor)));
}

export type Resolution =
  | { kind: 'match'; candidate: Candidate }
  | { kind: 'none'; candidates: Candidate[] }
  | { kind: 'ambiguous'; candidates: Candidate[] };

/** Decides, from scored candidates (best first), whether a subject matches one note, none, or is ambiguous. */
export function decide(candidates: Candidate[], config: ResolveConfig): Resolution {
  const matches = candidates.filter(c => c.score >= config.threshold);
  if (matches.length === 0) return { kind: 'none', candidates };
  const [first, second] = matches;
  const tiedExact = first!.exact && second?.exact;
  if (second && (!first!.exact || tiedExact) && first!.score - second.score < config.ambiguityMargin) {
    return { kind: 'ambiguous', candidates: matches.slice(0, 5) };
  }
  return { kind: 'match', candidate: first! };
}

interface Row {
  path: string;
  title: string;
  category: string;
  trigram: number | null;
  cosine: number | null;
  exact: boolean;
}

/** Finds existing notes that could be the same subject: exact slug/alias, trigram on names, vector on names. */
export async function findCandidates(
  db: Db,
  embedder: EmbeddingProvider,
  userId: string,
  subject: string,
  config: ResolveConfig,
): Promise<Candidate[]> {
  const norm = normalizeForMatch(subject);
  const slug = slugify(subject);
  const [vector] = await embedder.embedPassages([subject]);
  // Trigram similarity is taken per name (title or one alias), whole-string, so "Engine oil mobil" does not
  // fold into "Engine oil castrol" the way word-level similarity against all aliases glued together would.
  const res = await db.query<Row>(
    `SELECT n.path, n.title, n.category,
            COALESCE(t.sim, 0)::float8 AS trigram,
            (1 - (n.name_embedding <=> $4::vector))::float8 AS cosine,
            (n.path LIKE '%/' || $3 || '.md' OR $2 = ANY (string_to_array(n.names, ' | '))) AS exact
     FROM notes n
     LEFT JOIN LATERAL (
       SELECT max(similarity(x, $2)) AS sim FROM unnest(string_to_array(n.names, ' | ')) AS x
     ) t ON true
     WHERE n.user_id = $1
     ORDER BY exact DESC,
       GREATEST(COALESCE(t.sim, 0), (1 - (n.name_embedding <=> $4::vector) - $5::float8) / GREATEST(1 - $5::float8, 0.0001)) DESC
     LIMIT 8`,
    [userId, norm, slug, toVectorLiteral(vector!), config.vectorFloor],
  );
  return res.rows
    .map(r => {
      const trigram = r.trigram ?? 0;
      const cosine = r.cosine ?? 0;
      const score = r.exact ? 1 : Math.max(trigram, scaleCosine(cosine, config.vectorFloor));
      return { path: r.path, title: r.title, category: r.category, score, trigram, cosine, exact: r.exact };
    })
    .sort((a, b) => b.score - a.score);
}
