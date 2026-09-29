import { NextResponse } from "next/server";
import { searchYouthInWorkParticipants } from "@/lib/youthInWork";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") || "";
  const participants = await searchYouthInWorkParticipants(query);
  return NextResponse.json({ participants });
}
