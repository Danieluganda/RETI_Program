import { NextResponse } from "next/server";

import {
  searchYouthInWorkEmployers,
} from "@/lib/youthInWork";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
) {
  const url =
    new URL(request.url);

  const query =
    url.searchParams.get("q") || "";

  const eso =
    url.searchParams.get("eso") || "";

  if (
    !eso ||
    query.trim().length < 2
  ) {
    return NextResponse.json({
      employers: [],
    });
  }

  try {
    const employers =
      await searchYouthInWorkEmployers(
        query,
        eso,
      );

    return NextResponse.json({
      employers,
    });
  } catch (error) {
    console.error(
      "Employer search failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Employer search is unavailable.",
      },
      {
        status: 500,
      },
    );
  }
}