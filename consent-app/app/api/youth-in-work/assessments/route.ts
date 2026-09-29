import { NextResponse } from "next/server";
import { createYouthInWorkAssessment, getYouthInWorkAssessments } from "@/lib/youthInWork";

export const dynamic = "force-dynamic";

export async function GET() {
  const assessments = await getYouthInWorkAssessments();
  return NextResponse.json({ assessments });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!String(body.participantName || "").trim() || !String(body.youthInWorkStatus || "").trim()) {
      return NextResponse.json({ error: "Participant name and Youth in Work status are required." }, { status: 400 });
    }

    const result = await createYouthInWorkAssessment({
      participantId: body.participantId || undefined,
      participantName: String(body.participantName),
      participantPhone: String(body.participantPhone || ""),
      participantEmail: String(body.participantEmail || ""),
      participantExternalId: String(body.participantExternalId || ""),
      esoName: String(body.esoName || "Outreach"),
      district: String(body.district || ""),
      region: String(body.region || ""),
      businessName: String(body.businessName || ""),
      businessSector: String(body.businessSector || ""),
      employmentStatus: String(body.employmentStatus || ""),
      youthInWorkStatus: String(body.youthInWorkStatus),
      trainingInterest: String(body.trainingInterest || ""),
      supportNeeded: Array.isArray(body.supportNeeded) ? body.supportNeeded.map(String) : [],
      notes: String(body.notes || ""),
      assessorName: String(body.assessorName || ""),
    });

    return NextResponse.json({ participant: result.participant, assessment: result.assessment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the Youth in Work assessment.";
    const status = message.includes("already") || message.includes("matching") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
