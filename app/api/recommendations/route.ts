import { NextRequest, NextResponse } from "next/server";
import { LetterboxdUserNotFoundError } from "@/lib/letterboxd";
import { buildRecommendations } from "@/lib/recommend";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const region = typeof body?.region === "string" && body.region ? body.region : "CA";
  const providerIds = Array.isArray(body?.providerIds)
    ? body.providerIds.filter((id: unknown): id is number => typeof id === "number")
    : [];

  if (!username) {
    return NextResponse.json({ error: "A Letterboxd username is required." }, { status: 400 });
  }

  try {
    const result = await buildRecommendations({ username, region, providerIds });

    if (result.seedTitles.length === 0) {
      return NextResponse.json(
        {
          error:
            "Couldn't find any films rated 4 stars or higher in your recent Letterboxd diary to build recommendations from. Rate a few more films on Letterboxd (or check that your profile is public) and try again.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LetterboxdUserNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Something went wrong while building recommendations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
