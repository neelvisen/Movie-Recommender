export interface LetterboxdDiaryEntry {
  filmTitle: string;
  filmYear: number | null;
  /** 0.5-5 in half-star steps, null if logged without a rating */
  rating: number | null;
  watchedDate: string | null;
  rewatch: boolean;
  letterboxdUrl: string;
  /** Present when Letterboxd's feed includes a direct TMDB mapping */
  tmdbId: number | null;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMovie {
  id: number;
  title: string;
  releaseYear: number | null;
  overview: string;
  posterPath: string | null;
  genreIds: number[];
  voteAverage: number;
}

export interface WatchProviderOption {
  providerId: number;
  providerName: string;
  logoPath: string | null;
}

export interface MovieProviders {
  link: string | null;
  flatrate: WatchProviderOption[];
  rent: WatchProviderOption[];
  buy: WatchProviderOption[];
}

export interface Recommendation {
  movie: TmdbMovie;
  score: number;
  reasons: string[];
  providers: MovieProviders;
  /** Providers from the user's own selection that this movie is streamable on */
  availableOn: WatchProviderOption[];
}

export interface RecommendationRequest {
  username: string;
  region: string;
  /** TMDB watch-provider IDs the user is subscribed to; empty = show everything */
  providerIds: number[];
}
