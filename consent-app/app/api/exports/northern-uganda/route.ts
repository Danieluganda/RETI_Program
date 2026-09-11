import { withTimeout } from "@/lib/asyncTimeout";
import { getConsents } from "@/lib/db";
import { getNorthernUgandaActivityGate, northernUgandaActivityCsv } from "@/lib/northernUgandaActivity";
import type { ConsentRecord } from "@/lib/db";
import { getActiveParticipants } from "@/lib/participants";
import type { ParticipantSummary } from "@/lib/participants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const district = url.searchParams.get("district") || undefined;
  const eso = url.searchParams.get("eso") || undefined;
  let consentRecords: ConsentRecord[] = [];
  let participants: ParticipantSummary[] = [];
  let consentMatchStatus = "matched";
  let participantMatchStatus = "matched";

  const [recordsResult, participantsResult] = await Promise.allSettled([
    withTimeout(getConsents()),
    withTimeout(getActiveParticipants()),
  ]);
  if (recordsResult.status === "fulfilled") {
    consentRecords = recordsResult.value;
  } else {
    consentMatchStatus = "unavailable";
  }
  if (participantsResult.status === "fulfilled") {
    participants = participantsResult.value;
  } else {
    participantMatchStatus = "unavailable";
  }

  const gate = await getNorthernUgandaActivityGate(consentRecords, { district, eso, participants });

  return new Response(northernUgandaActivityCsv(gate.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="northern-uganda-consent-activity.csv"',
      "Cache-Control": "no-store",
      "X-Export-Record-Count": String(gate.rows.length),
      "X-Export-Source-Record-Count": String(gate.summary.sourceRows),
      "X-Export-District": gate.selectedDistrict,
      "X-Export-ESO": gate.selectedEso,
      "X-Consent-Match-Status": consentMatchStatus,
      "X-Participant-Match-Status": participantMatchStatus,
    },
  });
}
