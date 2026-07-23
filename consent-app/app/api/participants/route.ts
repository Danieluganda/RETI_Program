import { NextResponse } from "next/server";
import {
  getParticipantByIdForSelection,
  getParticipantDatasets,
  getParticipantsByEso,
  getParticipantsByEsoId,
} from "@/lib/participants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const esoId = searchParams.get("esoId") || "";
  const eso = searchParams.get("eso") || "";
  const participantId = searchParams.get("participantId") || "";
  const query = searchParams.get("q") || "";
  const dataset = searchParams.get("dataset") || "";
  const limit = Number(searchParams.get("limit") || "5000");

  if (searchParams.get("datasets") === "1") {
    const datasets = await getParticipantDatasets();
    return NextResponse.json({ datasets });
  }

  if (participantId.trim() && (esoId.trim() || eso.trim())) {
    const participant = await getParticipantByIdForSelection(participantId, esoId || eso);
    return NextResponse.json({ participants: participant ? [participant] : [] });
  }

  if (query.trim().length < 2) {
    return NextResponse.json({ participants: [] });
  }

  if (esoId.trim()) {
    const participants = await getParticipantsByEsoId(esoId, query, Number.isFinite(limit) ? limit : 5000, dataset);
    return NextResponse.json({ participants });
  }

  if (!eso.trim()) {
    return NextResponse.json({ participants: [] });
  }

  const participants = await getParticipantsByEso(eso, query, Number.isFinite(limit) ? limit : 5000, dataset);
  return NextResponse.json({ participants });
}
