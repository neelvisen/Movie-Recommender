import { fetchDiary } from "./letterboxd";
import { getGenreMap, getMovie, getRecommendationsFor, getWatchProviders, searchMovie } from "./tmdb";
import type { LetterboxdDiaryEntry, Recommendation, TmdbMovie } from "./types";

const SEED_COUNT = 8;
const CANDIDATE_LIMIT = 40;
const RESULT_LIMIT = 20;
const MIN_SEED_RATING = 4;

/** Runs `fn` over `items` with bounded concurrency; a single failed item is dropped, not fatal. */
async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R | null>, concurrency: number): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        const result = await fn(item);
        if (result !== null) results.push(result);
      } catch {
        // e.g. an obscure title TMDB can't match, or a transient API hiccup
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

interface ResolvedEntry {
  entry: LetterboxdDiaryEntry;
  movie: TmdbMovie;
}

async function resolveEntry(entry: LetterboxdDiaryEntry): Promise<ResolvedEntry | null> {
  const movie = entry.tmdbId ? await getMovie(entry.tmdbId) : await searchMovie(entry.filmTitle, entry.filmYear);
  return movie ? { entry, movie } : null;
}

export interface BuildRecommendationsInput {
  username: string;
  region: string;
  /** TMDB watch-provider IDs the user is subscribed to; empty means "show everything". */
  providerIds: number[];
}

export interface BuildRecommendationsResult {
  recommendations: Recommendation[];
  watchedCount: number;
  seedTitles: string[];
}

/**
 * Builds a recommendation list from a Letterboxd user's recent diary:
 *  1. Resolve diary entries to TMDB movies.
 *  2. Treat films rated 4+ stars as taste "seeds" and pull TMDB's
 *     recommendations for each.
 *  3. Score candidates by how many seeds surfaced them, plus a genre-affinity
 *     bonus from the user's whole rated history, excluding anything already watched.
 *  4. Attach Canada (or the requested region) streaming availability, and
 *     optionally filter down to the user's own subscriptions.
 */
export async function buildRecommendations({
  username,
  region,
  providerIds,
}: BuildRecommendationsInput): Promise<BuildRecommendationsResult> {
  const diary = await fetchDiary(username);
  if (diary.length === 0) {
    return { recommendations: [], watchedCount: 0, seedTitles: [] };
  }

  const resolved = await pMap(diary, resolveEntry, 5);
  const watchedIds = new Set(resolved.map((r) => r.movie.id));

  const genreWeight = new Map<number, number>();
  for (const { entry, movie } of resolved) {
    const weight = entry.rating ?? 3;
    for (const genreId of movie.genreIds) {
      genreWeight.set(genreId, (genreWeight.get(genreId) ?? 0) + weight);
    }
  }

  const seeds = resolved
    .filter((r) => (r.entry.rating ?? 0) >= MIN_SEED_RATING)
    .sort((a, b) => (b.entry.rating ?? 0) - (a.entry.rating ?? 0))
    .slice(0, SEED_COUNT);

  if (seeds.length === 0) {
    return { recommendations: [], watchedCount: watchedIds.size, seedTitles: [] };
  }

  const seedRecs = await pMap(seeds, async (seed) => ({ seed, recs: await getRecommendationsFor(seed.movie.id) }), 5);

  const candidateScores = new Map<number, { movie: TmdbMovie; score: number; fromSeeds: Set<string> }>();
  for (const { seed, recs } of seedRecs) {
    const seedBoost = seed.entry.rating ?? MIN_SEED_RATING;
    for (const candidate of recs) {
      if (watchedIds.has(candidate.id)) continue;
      const existing = candidateScores.get(candidate.id);
      if (existing) {
        existing.score += seedBoost;
        existing.fromSeeds.add(seed.movie.title);
      } else {
        candidateScores.set(candidate.id, { movie: candidate, score: seedBoost, fromSeeds: new Set([seed.movie.title]) });
      }
    }
  }

  for (const candidate of candidateScores.values()) {
    const genreScore = candidate.movie.genreIds.reduce((sum, g) => sum + (genreWeight.get(g) ?? 0), 0);
    candidate.score += genreScore * 0.1;
  }

  const topCandidates = [...candidateScores.values()].sort((a, b) => b.score - a.score).slice(0, CANDIDATE_LIMIT);

  const genreMap = await getGenreMap();

  const withProviders = await pMap(
    topCandidates,
    async (candidate) => ({ ...candidate, providers: await getWatchProviders(candidate.movie.id, region) }),
    5
  );

  const scored: Recommendation[] = withProviders.map((candidate) => {
    const availableOn = providerIds.length
      ? candidate.providers.flatrate.filter((p) => providerIds.includes(p.providerId))
      : candidate.providers.flatrate;
    const topGenres = candidate.movie.genreIds
      .map((id) => genreMap.get(id))
      .filter((name): name is string => Boolean(name))
      .slice(0, 2);
    const reasons = [
      ...[...candidate.fromSeeds].slice(0, 2).map((title) => `Because you loved "${title}"`),
      ...(topGenres.length ? [`Matches your taste for ${topGenres.join(" & ")}`] : []),
    ];
    return {
      movie: candidate.movie,
      score: candidate.score,
      reasons,
      providers: candidate.providers,
      availableOn,
    };
  });

  const filtered = providerIds.length ? scored.filter((r) => r.availableOn.length > 0) : scored;
  const final = filtered.sort((a, b) => b.score - a.score).slice(0, RESULT_LIMIT);

  return { recommendations: final, watchedCount: watchedIds.size, seedTitles: seeds.map((s) => s.movie.title) };
}
