"use client";

import Image from "next/image";
import { TMDB_LOGO_BASE } from "@/lib/tmdb";
import type { WatchProviderOption } from "@/lib/types";

interface ProviderPickerProps {
  providers: WatchProviderOption[];
  selectedIds: number[];
  onToggle: (providerId: number) => void;
}

export function ProviderPicker({ providers, selectedIds, onToggle }: ProviderPickerProps) {
  if (providers.length === 0) {
    return <p className="text-sm text-neutral-400">Loading streaming services…</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {providers.map((provider) => {
        const selected = selectedIds.includes(provider.providerId);
        return (
          <button
            key={provider.providerId}
            type="button"
            onClick={() => onToggle(provider.providerId)}
            aria-pressed={selected}
            title={provider.providerName}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition ${
              selected
                ? "border-letterboxd-green bg-letterboxd-green/10"
                : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
            }`}
          >
            {provider.logoPath ? (
              <Image
                src={`${TMDB_LOGO_BASE}${provider.logoPath}`}
                alt={provider.providerName}
                width={32}
                height={32}
                className="rounded"
              />
            ) : (
              <div className="h-8 w-8 rounded bg-neutral-800" />
            )}
            <span className="line-clamp-2 text-[11px] leading-tight text-neutral-300">{provider.providerName}</span>
          </button>
        );
      })}
    </div>
  );
}
