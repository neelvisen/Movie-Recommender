# Movie Recommender

A movie recommender web app. Enter a public Letterboxd username, and it suggests
films based on what you've rated highly — filtered down to what's actually
streaming for you (defaults to Canada).

## How it works

1. **Taste data — Letterboxd's public diary RSS feed.** Letterboxd has no
   official API, so this reads `https://letterboxd.com/<username>/rss/`
   (`lib/letterboxd.ts`), which needs no login. It covers your ~50 most
   recent diary entries and, for most films, includes a `tmdb:movieId` field
   that maps straight to a TMDB movie — no fuzzy title matching required.
2. **Recommendations — TMDB.** Films you rated 4★ or higher become "seeds";
   TMDB's `/movie/{id}/recommendations` is queried for each, candidates are
   scored by how many seeds surfaced them plus a genre-affinity bonus from
   your whole rated history, and anything you've already logged is excluded
   (`lib/recommend.ts`).
3. **Availability — TMDB watch/providers.** For each candidate, TMDB's
   `/movie/{id}/watch/providers` (JustWatch-sourced, region-aware) says
   what's streaming, renting, or buyable in your region. Pick which
   services you subscribe to and results filter down to those (`lib/tmdb.ts`).

No accounts, database, or OAuth — it's stateless. Your Letterboxd username and
selected streaming services are only remembered in your own browser's
`localStorage`.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Then get a free TMDB API key at <https://www.themoviedb.org/settings/api>
(the "API Read Access Token" isn't needed — the plain v3 API key is) and put
it in `.env.local`:

```
TMDB_API_KEY=your_key_here
```

```bash
npm run dev
```

Open <http://localhost:3000>, enter a public Letterboxd username, optionally
check off the streaming services you subscribe to, and hit "Get
recommendations".

## Testing

```bash
npm test
```

Unit tests (`tests/`) cover the RSS-parsing and scoring logic against fixture
data — they don't hit the network. **This was built in a sandboxed
environment with no outbound access to `letterboxd.com` or
`api.themoviedb.org`**, so the live integration hasn't been exercised against
the real APIs yet. `npm run dev` + a real TMDB key is the first real test —
do that before relying on this. The Letterboxd RSS field names
(`letterboxd:filmTitle`, `letterboxd:memberRating`, `tmdb:movieId`, etc.) are
implemented from documented/known feed structure; if Letterboxd has changed
its feed shape, `lib/letterboxd.ts` is the one file to check first.

## Region

Defaults to Canada (`CA`). Change `NEXT_PUBLIC_DEFAULT_REGION` in
`.env.local` for a different TMDB region code — the rest of the app is
already region-parameterized.

## Roadmap / not built yet

- **Friends.** The architecture supports it (region/provider filtering is
  already a pure function over a list of scored candidates), but there's no
  multi-user aggregation yet. Adding it means fetching multiple diaries,
  either merging taste profiles or intersecting "everyone would like this."
- **Fuller rating history.** The diary RSS only has ~50 recent entries. A
  user's complete ratings live at `letterboxd.com/<username>/films/ratings/`
  (paginated HTML, no RSS) — scraping that would need `cheerio` or similar
  and is more fragile than the RSS feed.
- **Persistence.** Currently nothing is stored server-side; recommendations
  are recomputed on every request. A cache (even just an in-memory TTL cache
  keyed by username) would cut down on repeat TMDB calls.
- **Rent/buy, not just subscriptions.** `MovieProviders` already carries
  `rent`/`buy` alongside `flatrate`; the UI only surfaces subscription
  ("flatrate") availability right now.

## Project layout

```
app/
  page.tsx                    Home page (username form, provider picker, results)
  api/recommendations/route.ts  POST { username, region, providerIds } -> recommendations
  api/providers/route.ts        GET ?region=CA -> streaming services for that region
lib/
  letterboxd.ts                Public diary RSS fetch + parse
  tmdb.ts                      TMDB API client
  recommend.ts                 Scoring/ranking engine
  types.ts                     Shared types
components/
  MovieCard.tsx, ProviderPicker.tsx
tests/
  letterboxd.test.ts, recommend.test.ts, fixtures/
```
