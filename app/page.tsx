"use client";

import { useEffect, useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { ProviderPicker } from "@/components/ProviderPicker";
import type { Recommendation, WatchProviderOption } from "@/lib/types";

const REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "CA";
const USERNAME_KEY = "movie-recommender:username";
const PROVIDERS_KEY = "movie-recommender:provider-ids";

export default function Home() {
  const [username, setUsername] = useState("");
  const [providers, setProviders] = useState<WatchProviderOption[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [seedTitles, setSeedTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedUsername = localStorage.getItem(USERNAME_KEY);
    if (savedUsername) setUsername(savedUsername);
    const savedProviders = localStorage.getItem(PROVIDERS_KEY);
    if (savedProviders) {
      try {
        setSelectedProviderIds(JSON.parse(savedProviders));
      } catch {
        // ignore malformed cache
      }
    }

    fetch(`/api/providers?region=${REGION}`)
      .then((res) => res.json())
      .then((data) => setProviders(data.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  function toggleProvider(providerId: number) {
    setSelectedProviderIds((current) => {
      const next = current.includes(providerId) ? current.filter((id) => id !== providerId) : [...current, providerId];
      localStorage.setItem(PROVIDERS_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;

    localStorage.setItem(USERNAME_KEY, username.trim());
    setLoading(true);
    setError(null);
    setRecommendations(null);

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), region: REGION, providerIds: selectedProviderIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }
      setRecommendations(data.recommendations);
      setSeedTitles(data.seedTitles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold">
          <span className="text-letterboxd-green">Movie</span> Recommender
        </h1>
        <p className="max-w-2xl text-neutral-400">
          Pulls your recent Letterboxd diary, finds films you&apos;ll probably love, and shows you only the ones you
          can actually stream in {REGION}.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-8 space-y-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-medium text-neutral-300">
            Letterboxd username
          </label>
          <div className="flex gap-2">
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. davidehrlich"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-letterboxd-green"
            />
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="whitespace-nowrap rounded-lg bg-letterboxd-green px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
            >
              {loading ? "Finding movies…" : "Get recommendations"}
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Your profile needs to be public. This reads your public diary — no login required.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-300">
            Which services do you subscribe to? (Leave blank to see everything.)
          </p>
          <ProviderPicker providers={providers} selectedIds={selectedProviderIds} onToggle={toggleProvider} />
        </div>
      </form>

      {error && (
        <div className="mb-8 rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-300">{error}</div>
      )}

      {recommendations && recommendations.length === 0 && !error && (
        <p className="text-neutral-400">
          No matches on your selected streaming services right now. Try selecting fewer services, or check back later.
        </p>
      )}

      {recommendations && recommendations.length > 0 && (
        <section>
          {seedTitles.length > 0 && (
            <p className="mb-4 text-sm text-neutral-500">
              Based on films you loved, including {seedTitles.slice(0, 3).join(", ")}
              {seedTitles.length > 3 ? ", and more" : ""}.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {recommendations.map((rec) => (
              <MovieCard key={rec.movie.id} recommendation={rec} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
