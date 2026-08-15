import Parser from "rss-parser";
import type { LetterboxdDiaryEntry } from "./types";

interface LetterboxdItem {
  filmTitle?: string;
  filmYear?: string;
  memberRating?: string;
  watchedDate?: string;
  rewatch?: string;
  tmdbMovieId?: string;
  link?: string;
}

const parser = new Parser<Record<string, never>, LetterboxdItem>({
  customFields: {
    item: [
      ["letterboxd:filmTitle", "filmTitle"],
      ["letterboxd:filmYear", "filmYear"],
      ["letterboxd:memberRating", "memberRating"],
      ["letterboxd:watchedDate", "watchedDate"],
      ["letterboxd:rewatch", "rewatch"],
      ["tmdb:movieId", "tmdbMovieId"],
    ],
  },
});

const USER_AGENT = "Mozilla/5.0 (compatible; MovieRecommenderApp/0.1)";

export class LetterboxdUserNotFoundError extends Error {
  constructor(username: string) {
    super(`Letterboxd user "${username}" wasn't found. Double-check the username (it's the part after letterboxd.com/ in your profile URL).`);
    this.name = "LetterboxdUserNotFoundError";
  }
}

/**
 * Letterboxd has no official public API. This reads a user's public diary
 * RSS feed (letterboxd.com/<username>/rss/), which needs no authentication.
 * Most film entries carry a `tmdb:movieId` field, which lets us skip fuzzy
 * title matching against TMDB for those. The feed only covers the user's
 * ~50 most recent diary entries.
 */
export async function fetchDiary(username: string): Promise<LetterboxdDiaryEntry[]> {
  const res = await fetch(`https://letterboxd.com/${encodeURIComponent(username)}/rss/`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 60 * 30 },
  });

  if (res.status === 404) {
    throw new LetterboxdUserNotFoundError(username);
  }
  if (!res.ok) {
    throw new Error(`Letterboxd RSS request failed with status ${res.status}`);
  }

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  return (feed.items ?? [])
    .filter((item): item is LetterboxdItem & { filmTitle: string } => Boolean(item.filmTitle))
    .map((item): LetterboxdDiaryEntry => ({
      filmTitle: item.filmTitle.trim(),
      filmYear: item.filmYear ? parseInt(item.filmYear, 10) : null,
      rating: item.memberRating ? parseFloat(item.memberRating) : null,
      watchedDate: item.watchedDate ?? null,
      rewatch: item.rewatch === "Yes",
      letterboxdUrl: item.link ?? "",
      tmdbId: item.tmdbMovieId ? parseInt(item.tmdbMovieId, 10) : null,
    }));
}
