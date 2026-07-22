import { NextResponse } from "next/server";
import { getParticipantByIdForSelection, getParticipantsByEso, getParticipantsByEsoId } from "@/lib/participants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const esoId = searchParams.get("esoId") || "";
  const eso = searchParams.get("eso") || "";
  const participantId = searchParams.get("participantId") || "";
  const query = searchParams.get("q") || "";
  const limit = Number(searchParams.get("limit") || "100");

  if (participantId.trim() && (esoId.trim() || eso.trim())) {
    const participant = await getParticipantByIdForSelection(participantId, esoId || eso);
    return NextResponse.json({ participants: participant ? [participant] : [] });
  }

  if (esoId.trim()) {
    const participants = await getParticipantsByEsoId(esoId, query, Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ participants });
  }

  if (!eso.trim()) {
    return NextResponse.json({ participants: [] });
  }

  const participants = await getParticipantsByEso(eso, query);
  return NextResponse.json({ participants });
}
