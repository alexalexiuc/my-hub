/** One ranked result list from one search leg for one query. Earlier ids rank higher. */
export interface Ranking {
  /** Leg name, reported back as `matchedBy`. */
  leg: string;
  ids: string[];
  /** Multiplies this list's contribution (default 1). */
  weight?: number;
}

export interface FusedScore {
  id: string;
  score: number;
  legs: string[];
}

/** Standard Reciprocal Rank Fusion constant. */
const DEFAULT_RRF_K = 60;

/**
 * Reciprocal Rank Fusion: `score(id) = Σ weight / (k + rank)` over every ranking the id appears in (rank is 1-based).
 * Returns ids sorted by score, highest first; ties keep first-seen order.
 */
export function reciprocalRankFusion(rankings: Ranking[], k: number = DEFAULT_RRF_K): FusedScore[] {
  const scores = new Map<string, FusedScore>();
  for (const { leg, ids, weight = 1 } of rankings) {
    ids.forEach((id, i) => {
      let entry = scores.get(id);
      if (!entry) scores.set(id, (entry = { id, score: 0, legs: [] }));
      entry.score += weight / (k + i + 1);
      if (!entry.legs.includes(leg)) entry.legs.push(leg);
    });
  }
  return [...scores.values()].sort((a, b) => b.score - a.score);
}
