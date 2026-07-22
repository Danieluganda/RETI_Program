import { NextResponse } from "next/server";
import { getParticipantsByEso } from "@/lib/participants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eso = searchParams.get("eso") || "";
  const query = searchParams.get("q") || "";

  if (!eso.trim()) {
    return NextResponse.json({ participants: [] });
  }

  const participants = await getParticipantsByEso(eso, query);
  return NextResponse.json({ participants });
}
