import { PrismaClient, type Participant } from "@prisma/client";

const globalForParticipants = globalThis as unknown as { participantPrisma?: PrismaClient };

const esoAliases: Record<string, string> = {
  agdi: "AGDI",
  aid: "AID",
  challenges: "Challenges Uganda",
  curad: "CURAD",
  dfcu: "DFCU Foundation",
  echai: "ECHAI",
  excel: "ECHAI",
  findingxy: "Finding XY",
  finding: "Finding XY",
  leu: "Living Earth Uganda",
  livingearth: "Living Earth Uganda",
  mkazi: "Mkazipreneur",
  mkazipreneur: "Mkazipreneur",
  mubs: "MUBS EIC",
  pedn: "PEDN",
  stanbic: "Stanbic Bank Incubator",
  xy: "Finding XY",
  alb: "AID",
};

function prisma() {
  if (!globalForParticipants.participantPrisma) {
    globalForParticipants.participantPrisma = new PrismaClient();
  }

  return globalForParticipants.participantPrisma;
}

export function normalizeText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeName(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizePhone(value: string) {
  const cleaned = normalizeText(value);
  if (!cleaned) return "";

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return cleaned;
  if (digits.startsWith("256")) return `+${digits}`;
  if (digits.length === 9) return `+256${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+256${digits.slice(1)}`;
  return cleaned.startsWith("+") ? cleaned : `+${digits}`;
}

export function normalizeEso(value: string) {
  const cleaned = normalizeText(value);
  const key = cleaned.toLowerCase().replace(/[^a-z]/g, "");

  for (const [alias, eso] of Object.entries(esoAliases)) {
    if (key.includes(alias)) return eso;
  }

  return cleaned;
}

export type ParticipantSummary = {
  id: string;
  externalId: string;
  fullName: string;
  phone: string;
  email: string;
  esoName: string;
  district: string;
  region: string;
  sector: string;
};

export function toParticipantSummary(participant: Participant): ParticipantSummary {
  return {
    id: participant.id,
    externalId: participant.externalId || "",
    fullName: participant.fullName,
    phone: participant.phone || "",
    email: participant.email || "",
    esoName: participant.esoName,
    district: participant.district || "",
    region: participant.region || "",
    sector: participant.sector || "",
  };
}

export async function getParticipantsByEso(esoName: string, query = "") {
  const normalizedEso = normalizeEso(esoName);
  const normalizedQuery = normalizeText(query);

  const participants = await prisma().participant.findMany({
    where: {
      esoName: normalizedEso,
      status: "active",
      ...(normalizedQuery
        ? {
            OR: [
              { fullName: { contains: normalizedQuery, mode: "insensitive" } },
              { phone: { contains: normalizedQuery } },
              { externalId: { contains: normalizedQuery, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ fullName: "asc" }],
    take: 500,
  });

  return participants.map(toParticipantSummary);
}
