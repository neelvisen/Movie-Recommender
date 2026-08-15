import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LetterboxdDiaryEntry } from "@/lib/types";

vi.mock("@/lib/letterboxd", () => ({
  fetchDiary: vi.fn(),
}));
vi.mock("@/lib/tmdb", () => ({
  getMovie: vi.fn(),
  searchMovie: vi.fn(),
  getRecommendationsFor: vi.fn(),
  getWatchProviders: vi.fn(),
  getGenreMap: vi.fn(),
}));

import { fetchDiary } from "@/lib/letterboxd";
import { buildRecommendations } from "@/lib/recommend";
import { getGenreMap, getMovie, getRecommendationsFor, getWatchProviders } from "@/lib/tmdb";

const diary: LetterboxdDiaryEntry[] = [
  {
    filmTitle: "Her",
    filmYear: 2013,
    rating: 5,
    watchedDate: "2024-01-15",
    rewatch: false,
    letterboxdUrl: "https://letterboxd.com/testuser/film/her/",
    tmdbId: 1,
  },
  {
    filmTitle: "Cats",
    filmYear: 2019,
    rating: 1,
    watchedDate: "2024-01-07",
    rewatch: false,
    letterboxdUrl: "https://letterboxd.com/testuser/film/cats-2019/",
    tmdbId: 2,
  },
];

const movies: Record<number, ReturnType<typeof movie>> = {};
function movie(id: number, title: string, genreIds: number[]) {
  return { id, title, releaseYear: 2020, overview: "", posterPath: null, genreIds, voteAverage: 7 };
}
movies[1] = movie(1, "Her", [18, 878]);
movies[2] = movie(2, "Cats", [35]);
movies[3] = movie(3, "Movie A", [18, 878]);
movies[4] = movie(4, "Movie B", [35]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDiary).mockResolvedValue(diary);
  vi.mocked(getMovie).mockImplementation(async (id: number) => movies[id]);
  vi.mocked(getRecommendationsFor).mockImplementation(async (id: number) =>
    id === 1 ? [movies[2], movies[3], movies[4]] : []
  );
  vi.mocked(getGenreMap).mockResolvedValue(
    new Map([
      [18, "Drama"],
      [878, "Science Fiction"],
      [35, "Comedy"],
    ])
  );
  vi.mocked(getWatchProviders).mockImplementation(async (id: number) => {
    if (id === 3) {
      return { link: null, flatrate: [{ providerId: 8, providerName: "Netflix", logoPath: null }], rent: [], buy: [] };
    }
    if (id === 4) {
      return { link: null, flatrate: [{ providerId: 9, providerName: "Prime Video", logoPath: null }], rent: [], buy: [] };
    }
    return { link: null, flatrate: [], rent: [], buy: [] };
  });
});

describe("buildRecommendations", () => {
  it("excludes already-watched films and ranks candidates by seed + genre affinity", async () => {
    const result = await buildRecommendations({ username: "testuser", region: "CA", providerIds: [] });

    expect(result.watchedCount).toBe(2);
    expect(result.seedTitles).toEqual(["Her"]); // only the 5-star film clears the seed threshold

    const ids = result.recommendations.map((r) => r.movie.id);
    expect(ids).not.toContain(2); // Cats was already watched, must not be recommended
    expect(ids).toEqual([3, 4]); // Movie A outranks Movie B: same seed boost, plus genre overlap with Her

    const movieA = result.recommendations.find((r) => r.movie.id === 3)!;
    expect(movieA.reasons).toContain('Because you loved "Her"');
    expect(movieA.reasons).toContain("Matches your taste for Drama & Science Fiction");
  });

  it("filters results down to the user's selected streaming providers", async () => {
    const result = await buildRecommendations({ username: "testuser", region: "CA", providerIds: [8] });

    const ids = result.recommendations.map((r) => r.movie.id);
    expect(ids).toEqual([3]); // only Movie A is on Netflix; Movie B (Prime) is filtered out
    expect(result.recommendations[0].availableOn).toEqual([{ providerId: 8, providerName: "Netflix", logoPath: null }]);
  });

  it("returns no recommendations when nothing in the diary was rated highly enough to seed from", async () => {
    vi.mocked(fetchDiary).mockResolvedValue([diary[1]]); // only the 1-star Cats entry

    const result = await buildRecommendations({ username: "testuser", region: "CA", providerIds: [] });

    expect(result.seedTitles).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
});
