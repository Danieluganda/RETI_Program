import { getYouthInWorkAssessments } from "@/lib/youthInWork";

export const dynamic = "force-dynamic";

function clean(value: string | null) {
  return (value || "").trim();
}

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function cell(value: unknown) {
  if (Array.isArray(value)) value = value.join("; ");
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "all";
}

function periodStart(period: string) {
  const now = new Date();

  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (period === "week") {
    const date = new Date(now);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = normalize(url.searchParams.get("q"));
  const eso = clean(url.searchParams.get("eso"));
  const district = clean(url.searchParams.get("district"));
  const sector = clean(url.searchParams.get("sector"));
  const period = clean(url.searchParams.get("period"));
  const start = periodStart(period);
  let assessments: Awaited<ReturnType<typeof getYouthInWorkAssessments>>;

  try {
    assessments = await getYouthInWorkAssessments();
  } catch (error) {
    console.error("Could not export Youth in Work submissions:", error);
    return new Response(
      "Youth in Work submissions are temporarily unavailable because the database could not be reached.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const filtered = assessments.filter((assessment) => {
    const searchTarget = [
      assessment.participantName,
      assessment.participantEmail,
      assessment.participantPhone,
      assessment.participantExternalId,
      assessment.esoName,
      assessment.district,
      assessment.businessSector,
    ].map(normalize).join(" ");

    if (q && !searchTarget.includes(q)) return false;
    if (eso && clean(assessment.esoName) !== eso) return false;
    if (district && clean(assessment.district) !== district) return false;
    if (sector && clean(assessment.businessSector) !== sector) return false;
    if (start && new Date(assessment.assessmentDate) < start) return false;
    return true;
  });

  const headers = [
    "assessmentId",
    "participantId",
    "participantName",
    "participantPhone",
    "participantEmail",
    "participantExternalId",
    "esoName",
    "district",
    "region",
    "businessName",
    "businessSector",
    "employmentStatus",
    "foundationCourseStatus",
    "foundationLearning",
    "incomeFromProgram",
    "incomeAmount",
    "workImproved",
    "workImprovementDescription",
    "improvementOutcomes",
    "youthInWorkStatus",
    "trainingInterest",
    "supportNeeded",
    "notes",
    "assessorName",
    "gpsLatitude",
    "gpsLongitude",
    "gpsAccuracy",
    "assessmentDate",
    "source",
    "status",
    "createdAt",
    "updatedAt",
  ] as const;

  const rows = filtered.map((assessment) =>
    [
      assessment.id,
      assessment.participantId,
      assessment.participantName,
      assessment.participantPhone,
      assessment.participantEmail,
      assessment.participantExternalId,
      assessment.esoName,
      assessment.district,
      assessment.region,
      assessment.businessName,
      assessment.businessSector,
      assessment.employmentStatus,
      assessment.foundationCourseStatus,
      assessment.foundationLearning,
      assessment.incomeFromProgram,
      assessment.incomeAmount,
      assessment.workImproved,
      assessment.workImprovementDescription,
      assessment.improvementOutcomes,
      assessment.youthInWorkStatus,
      assessment.trainingInterest,
      assessment.supportNeeded,
      assessment.notes,
      assessment.assessorName,
      assessment.gpsLatitude,
      assessment.gpsLongitude,
      assessment.gpsAccuracy,
      assessment.assessmentDate.toISOString(),
      assessment.source,
      assessment.status,
      assessment.createdAt.toISOString(),
      assessment.updatedAt.toISOString(),
    ].map(cell).join(","),
  );

  const csv = [headers.join(","), ...rows].join("\r\n");
  const suffix = eso ? `-${safeFilePart(eso)}` : "";

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="youth-in-work-submissions${suffix}.csv"`,
      "Cache-Control": "no-store",
      "X-Export-Record-Count": String(filtered.length),
    },
  });
}
