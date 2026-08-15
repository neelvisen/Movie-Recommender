import Image from "next/image";
import { TMDB_POSTER_BASE } from "@/lib/tmdb";
import type { Recommendation } from "@/lib/types";

export function MovieCard({ recommendation }: { recommendation: Recommendation }) {
  const { movie, reasons, availableOn, providers } = recommendation;
  const showAvailability = availableOn.length > 0 ? availableOn : providers.flatrate;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="relative aspect-[2/3] w-full bg-neutral-800">
        {movie.posterPath ? (
          <Image
            src={`${TMDB_POSTER_BASE}${movie.posterPath}`}
            alt={movie.title}
            fill
            sizes="(max-width: 768px) 45vw, 200px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-neutral-500">
            No poster available
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="font-semibold leading-tight">
          {movie.title} {movie.releaseYear ? <span className="text-neutral-500">({movie.releaseYear})</span> : null}
        </h3>
        {reasons.length > 0 && (
          <ul className="space-y-0.5 text-xs text-neutral-400">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {showAvailability.length > 0 ? (
            showAvailability.map((provider) => (
              <span
                key={provider.providerId}
                className="rounded-full bg-letterboxd-green/10 px-2 py-0.5 text-[11px] text-letterboxd-green"
              >
                {provider.providerName}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-neutral-500">Not streaming in your region right now</span>
          )}
        </div>
      </div>
    </div>
  );
}
