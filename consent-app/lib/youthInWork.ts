import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { normalizeName, normalizePhone, normalizeText, toParticipantSummary, type ParticipantSummary } from "./participants";

const globalForYouthInWork = globalThis as unknown as { youthInWorkPrisma?: PrismaClient };

function prisma() {
  if (!globalForYouthInWork.youthInWorkPrisma) {
    globalForYouthInWork.youthInWorkPrisma = new PrismaClient();
  }

  return globalForYouthInWork.youthInWorkPrisma;
}

export type YouthInWorkAssessmentInput = {
  participantId?: string;
  participantName: string;
  participantPhone?: string;
  participantEmail?: string;
  participantExternalId?: string;
  esoName?: string;
  district?: string;
  region?: string;
  businessName?: string;
  businessSector?: string;
  employmentStatus?: string;
  foundationCourseStatus?: string;
  foundationLearning?: string;
  incomeFromProgram?: string;
  incomeAmount?: number;
  workImproved?: string;
  workImprovementDescription?: string;
  improvementOutcomes?: string[];
  youthInWorkStatus: string;
  trainingInterest?: string;
  supportNeeded?: string[];
  notes?: string;
  assessorName?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracy?: number;
};

function duplicateError() {
  return new Error("This participant already has a Youth in Work assessment.");
}

export async function searchYouthInWorkParticipants(query: string, limit = 30) {
  const search = normalizeText(query);
  if (search.length < 2) return [];

  const participants = await prisma().participant.findMany({
    where: {
      status: "active",
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { externalId: { contains: search, mode: "insensitive" } },
      ],
    },
    orderBy: { fullName: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
  });

  const assessed = new Set(
    (
      await prisma().youthInWorkAssessment.findMany({
        where: { participantId: { in: participants.map((participant) => participant.id) } },
        select: { participantId: true },
      })
    ).map((assessment) => assessment.participantId),
  );

  return participants.map((participant) => ({
    ...toParticipantSummary(participant),
    hasAssessment: assessed.has(participant.id),
  }));
}

async function findExistingParticipant(input: YouthInWorkAssessmentInput) {
  const name = normalizeName(input.participantName);
  const phone = normalizePhone(input.participantPhone || "");
  const email = normalizeText(input.participantEmail || "").toLowerCase();

  return prisma().participant.findFirst({
    where: {
      status: "active",
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }, { phone: normalizePhone(input.participantPhone || "") }] : []),
        ...(name ? [{ normalizedName: name.toLowerCase() }] : []),
      ],
    },
  });
}

export async function createOrUseYouthInWorkParticipant(input: YouthInWorkAssessmentInput) {
  if (input.participantId) {
    const participant = await prisma().participant.findFirst({
      where: { id: input.participantId, status: "active" },
    });
    if (!participant) throw new Error("The selected participant could not be found.");
    return participant;
  }

  const existing = await findExistingParticipant(input);
  if (existing) {
    throw new Error("A participant with matching name, phone, or email already exists. Search and select that person instead.");
  }

  return prisma().participant.create({
    data: {
      id: randomUUID(),
      fullName: normalizeName(input.participantName),
      normalizedName: normalizeName(input.participantName).toLowerCase(),
      phone: normalizePhone(input.participantPhone || "") || null,
      email: normalizeText(input.participantEmail || "").toLowerCase() || null,
      externalId: input.participantExternalId?.trim() || null,
      esoName: normalizeText(input.esoName || "Outreach") || "Outreach",
      district: normalizeText(input.district || "") || null,
      region: normalizeText(input.region || "") || null,
      source: "youth_in_work_tool",
      status: "active",
    },
  });
}

export async function createYouthInWorkAssessment(input: YouthInWorkAssessmentInput) {
  const participant = await createOrUseYouthInWorkParticipant(input);
  const existing = await prisma().youthInWorkAssessment.findUnique({
    where: { participantId: participant.id },
    select: { id: true },
  });
  if (existing) throw duplicateError();

  const assessment = await prisma().youthInWorkAssessment.create({
    data: {
      participantId: participant.id,
      participantName: participant.fullName,
      participantPhone: participant.phone,
      participantEmail: participant.email,
      participantExternalId: participant.externalId,
      esoName: participant.esoName || input.esoName || "Outreach",
      district: participant.district || input.district || null,
      region: participant.region || input.region || null,
      businessName: normalizeText(input.businessName || "") || null,
      businessSector: normalizeText(input.businessSector || "") || null,
      employmentStatus: normalizeText(input.employmentStatus || "") || null,
      foundationCourseStatus: normalizeText(input.foundationCourseStatus || "") || null,
      foundationLearning: normalizeText(input.foundationLearning || "") || null,
      incomeFromProgram: normalizeText(input.incomeFromProgram || "") || null,
      incomeAmount: Number.isFinite(input.incomeAmount) ? input.incomeAmount : null,
      workImproved: normalizeText(input.workImproved || "") || null,
      workImprovementDescription: normalizeText(input.workImprovementDescription || "") || null,
      improvementOutcomes: (input.improvementOutcomes || []).map(normalizeText).filter(Boolean),
      youthInWorkStatus: normalizeText(input.youthInWorkStatus),
      trainingInterest: normalizeText(input.trainingInterest || "") || null,
      supportNeeded: (input.supportNeeded || []).map(normalizeText).filter(Boolean),
      notes: normalizeText(input.notes || "") || null,
      assessorName: normalizeText(input.assessorName || "") || null,
      gpsLatitude: Number.isFinite(input.gpsLatitude) ? input.gpsLatitude : null,
      gpsLongitude: Number.isFinite(input.gpsLongitude) ? input.gpsLongitude : null,
      gpsAccuracy: Number.isFinite(input.gpsAccuracy) ? input.gpsAccuracy : null,
      assessmentDate: new Date(),
    },
  });

  return { participant, assessment };
}

export async function getYouthInWorkAssessments() {
  return prisma().youthInWorkAssessment.findMany({
    orderBy: { assessmentDate: "desc" },
    take: 500,
  });
}
