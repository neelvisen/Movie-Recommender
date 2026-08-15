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

  it("diversifies seeds so one recently-clustered genre can't crowd out the rest of your taste", async () => {
    const ROMANCE = 10749;
    const SCIFI = 878;
    const romanceDiary: LetterboxdDiaryEntry[] = [5, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4].map((rating, i) => ({
      filmTitle: `Romance ${i + 1}`,
      filmYear: 2020,
      rating,
      watchedDate: "2024-01-01",
      rewatch: false,
      letterboxdUrl: "",
      tmdbId: 100 + i,
    }));
    const scifiDiary: LetterboxdDiaryEntry[] = [4.3, 4.2].map((rating, i) => ({
      filmTitle: `Sci-Fi ${i + 1}`,
      filmYear: 2020,
      rating,
      watchedDate: "2024-01-01",
      rewatch: false,
      letterboxdUrl: "",
      tmdbId: 200 + i,
    }));

    vi.mocked(fetchDiary).mockResolvedValue([...romanceDiary, ...scifiDiary]);
    vi.mocked(getMovie).mockImplementation(async (id: number) =>
      id >= 200 ? movie(id, `Sci-Fi ${id - 199}`, [SCIFI]) : movie(id, `Romance ${id - 99}`, [ROMANCE])
    );

    const result = await buildRecommendations({ username: "testuser", region: "CA", providerIds: [] });

    // 9 films qualify as seeds (rating >= 4) but only 8 seed slots exist. The old
    // "top 8 by rating" rule would fill 7 of them with romance and cut both sci-fi
    // films down to one. With a 2-per-genre cap, both sci-fi films make the cut...
    expect(result.seedTitles).toEqual(expect.arrayContaining(["Sci-Fi 1", "Sci-Fi 2"]));
    // ...and the lowest-rated romance is what gets dropped to make room instead.
    expect(result.seedTitles).not.toContain("Romance 7");
    expect(result.seedTitles).toHaveLength(8);
  });

  it("treats a disliked genre as a negative signal rather than always-positive weight", async () => {
    vi.mocked(fetchDiary).mockResolvedValue([
      {
        filmTitle: "Loved Action Movie",
        filmYear: 2020,
        rating: 5,
        watchedDate: "2024-01-01",
        rewatch: false,
        letterboxdUrl: "",
        tmdbId: 300,
      },
      {
        filmTitle: "Hated Comedy",
        filmYear: 2020,
        rating: 1,
        watchedDate: "2024-01-01",
        rewatch: false,
        letterboxdUrl: "",
        tmdbId: 301,
      },
    ]);
    vi.mocked(getMovie).mockImplementation(async (id: number) => {
      if (id === 300) return movie(300, "Loved Action Movie", [28]);
      return movie(301, "Hated Comedy", [35]);
    });
    vi.mocked(getRecommendationsFor).mockImplementation(async (id: number) =>
      id === 300 ? [movie(310, "Candidate Action", [28]), movie(311, "Candidate Comedy", [35])] : []
    );

    const result = await buildRecommendations({ username: "testuser", region: "CA", providerIds: [] });

    const action = result.recommendations.find((r) => r.movie.id === 310)!;
    const comedy = result.recommendations.find((r) => r.movie.id === 311)!;

    // Both got the same seed boost (5, from "Loved Action Movie" recommending them both);
    // genre affinity should push one above that baseline and the other below it.
    expect(action.score).toBeGreaterThan(5);
    expect(comedy.score).toBeLessThan(5);
  });
});
