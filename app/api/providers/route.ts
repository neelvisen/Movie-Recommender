import { NextRequest, NextResponse } from "next/server";
import { listRegionProviders } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") || "CA";
  try {
    const providers = await listRegionProviders(region);
    return NextResponse.json({ providers });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to load streaming providers.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
