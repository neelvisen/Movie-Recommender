import type { MovieProviders, TmdbGenre, TmdbMovie, WatchProviderOption } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";
export const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w45";

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error(
      "TMDB_API_KEY is not set. Get a free key at https://www.themoviedb.org/settings/api and add it to .env.local"
    );
  }
  return key;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, { next: { revalidate: 60 * 60 * 6 } });
  if (!res.ok) {
    throw new Error(`TMDB request to ${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface TmdbApiMovie {
  id: number;
  title: string;
  release_date?: string;
  overview: string;
  poster_path: string | null;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  vote_average: number;
}

function toTmdbMovie(m: TmdbApiMovie): TmdbMovie {
  return {
    id: m.id,
    title: m.title,
    releaseYear: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) || null : null,
    overview: m.overview,
    posterPath: m.poster_path,
    genreIds: m.genre_ids ?? m.genres?.map((g) => g.id) ?? [],
    voteAverage: m.vote_average,
  };
}

export async function searchMovie(title: string, year: number | null): Promise<TmdbMovie | null> {
  const params: Record<string, string> = { query: title };
  if (year) params.year = String(year);
  const data = await tmdbFetch<{ results: TmdbApiMovie[] }>("/search/movie", params);
  const best = data.results?.[0];
  return best ? toTmdbMovie(best) : null;
}

export async function getMovie(id: number): Promise<TmdbMovie> {
  const m = await tmdbFetch<TmdbApiMovie>(`/movie/${id}`);
  return toTmdbMovie(m);
}

export async function getRecommendationsFor(id: number): Promise<TmdbMovie[]> {
  const data = await tmdbFetch<{ results: TmdbApiMovie[] }>(`/movie/${id}/recommendations`);
  return (data.results ?? []).map(toTmdbMovie);
}

interface TmdbApiProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

interface TmdbApiProvidersResponse {
  results: Record<
    string,
    {
      link?: string;
      flatrate?: TmdbApiProvider[];
      rent?: TmdbApiProvider[];
      buy?: TmdbApiProvider[];
    }
  >;
}

function toOption(p: TmdbApiProvider): WatchProviderOption {
  return { providerId: p.provider_id, providerName: p.provider_name, logoPath: p.logo_path };
}

export async function getWatchProviders(movieId: number, region: string): Promise<MovieProviders> {
  const data = await tmdbFetch<TmdbApiProvidersResponse>(`/movie/${movieId}/watch/providers`);
  const forRegion = data.results?.[region];
  if (!forRegion) {
    return { link: null, flatrate: [], rent: [], buy: [] };
  }
  return {
    link: forRegion.link ?? null,
    flatrate: (forRegion.flatrate ?? []).map(toOption),
    rent: (forRegion.rent ?? []).map(toOption),
    buy: (forRegion.buy ?? []).map(toOption),
  };
}

export async function listRegionProviders(region: string): Promise<WatchProviderOption[]> {
  const data = await tmdbFetch<{ results: TmdbApiProvider[] }>("/watch/providers/movie", {
    watch_region: region,
  });
  return (data.results ?? [])
    .map(toOption)
    .sort((a, b) => a.providerName.localeCompare(b.providerName));
}

/**
 * Services actually worth showing right now. Matched by substring against
 * whatever TMDB returns, so small naming differences (e.g. "Apple TV Plus"
 * vs "Apple TV") still match. Edit this list as your subscriptions change.
 */
const CURATED_PROVIDER_PATTERNS = [/netflix/i, /crave/i, /disney/i, /prime video/i, /apple tv/i, /criterion/i];

export function isCuratedProvider(providerName: string): boolean {
  return CURATED_PROVIDER_PATTERNS.some((pattern) => pattern.test(providerName));
}

export async function getGenreMap(): Promise<Map<number, string>> {
  const data = await tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list");
  return new Map(data.genres.map((g) => [g.id, g.name]));
}
