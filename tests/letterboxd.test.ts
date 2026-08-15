import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDiary, LetterboxdUserNotFoundError } from "@/lib/letterboxd";

const fixture = fs.readFileSync(path.join(__dirname, "fixtures/letterboxd-diary.xml"), "utf-8");

describe("fetchDiary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses letterboxd: and tmdb: namespaced fields from the diary RSS feed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => fixture })
    );

    const entries = await fetchDiary("testuser");

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      filmTitle: "Her",
      filmYear: 2013,
      rating: 5,
      watchedDate: "2024-01-15",
      rewatch: false,
      letterboxdUrl: "https://letterboxd.com/testuser/film/her/1/",
      tmdbId: 152601,
    });
    // half-star rating and a rewatch flag should both parse correctly
    expect(entries[2].rating).toBe(4.5);
    expect(entries[2].rewatch).toBe(true);
  });

  it("throws LetterboxdUserNotFoundError on a 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" })
    );

    await expect(fetchDiary("nobody")).rejects.toBeInstanceOf(LetterboxdUserNotFoundError);
  });
});
