import { PrismaClient, type Participant } from "@prisma/client";

const globalForParticipants = globalThis as unknown as { participantPrisma?: PrismaClient };

const esoAliases: Record<string, string> = {
  agdi: "AGDI",
  aid: "AID",
  challenges: "Challenges Uganda",
  curad: "CURAD",
  dfcu: "DFCU Foundation",
  echai: "ECHAI/Excelhort",
  excel: "ECHAI/Excelhort",
  excelhort: "ECHAI/Excelhort",
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

function displayEsoName(value: string) {
  return normalizeEso(value);
}

function esoSearchNames(value: string) {
  const normalized = normalizeEso(value);
  return normalized === "ECHAI/Excelhort" ? [normalized, "ECHAI", "Excelhort", "ECHAI Excelhort"] : [normalized];
}

export type ParticipantSummary = {
  id: string;
  externalId: string;
  fullName: string;
  phone: string;
  email: string;
  esoId: string;
  esoName: string;
  district: string;
  region: string;
  sector: string;
  status: string;
  createdAt: string;
  source: string;
};

type LegacyParticipantRow = {
  id: string;
  externalId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  esoName: string;
  district: string | null;
  region: string | null;
  sector: string | null;
  status?: string;
  createdAt?: Date | string;
  source?: string;
};

function isMissingColumnOrTable(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && ["P2021", "P2022"].includes(String((error as { code?: string }).code))) return true;

  const message = "message" in error ? String((error as { message?: string }).message || "") : "";
  return message.includes("Unknown argument `source`") || message.includes("Unknown field `source`");
}

export function toParticipantSummary(participant: Participant): ParticipantSummary {
  return {
    id: participant.id,
    externalId: participant.externalId || "",
    fullName: participant.fullName,
    phone: participant.phone || "",
    email: participant.email || "",
    esoId: participant.esoId || "",
    esoName: displayEsoName(participant.esoName),
    district: participant.district || "",
    region: participant.region || "",
    sector: participant.sector || "",
    status: participant.status,
    createdAt: participant.createdAt.toISOString(),
    source: participant.source,
  };
}

function toLegacyParticipantSummary(participant: LegacyParticipantRow): ParticipantSummary {
  return {
    id: participant.id,
    externalId: participant.externalId || "",
    fullName: participant.fullName,
    phone: participant.phone || "",
    email: participant.email || "",
    esoId: "",
    esoName: displayEsoName(participant.esoName),
    district: participant.district || "",
    region: participant.region || "",
    sector: participant.sector || "",
    status: participant.status || "active",
    createdAt: participant.createdAt
      ? participant.createdAt instanceof Date
        ? participant.createdAt.toISOString()
        : String(participant.createdAt)
      : "",
    source: participant.source || "participant_csv",
  };
}

export async function getParticipantsByEso(esoName: string, query = "", limit = 5000, dataset = "") {
  const normalizedEso = normalizeEso(esoName);
  const esoNames = esoSearchNames(esoName);
  const normalizedQuery = normalizeText(query);
  const take = Math.min(Math.max(limit, 1), 5000);

  try {
    const participants = await prisma().participant.findMany({
      where: {
        esoName: { in: esoNames },
        status: "active",
        ...(dataset ? { source: dataset } : {}),
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
      take,
    });

    return participants.map(toParticipantSummary);
  } catch (error) {
    if (!isMissingColumnOrTable(error)) throw error;

    const search = `%${normalizedQuery}%`;
    const participants = normalizedQuery
      ? await prisma().$queryRaw<LegacyParticipantRow[]>`
          SELECT id, "externalId", "fullName", phone, email, "esoName", district, region, sector, status, "createdAt"
          FROM "Participant"
          WHERE "esoName" = ANY(${esoNames})
            AND status = 'active'
            AND (
              "fullName" ILIKE ${search}
              OR phone LIKE ${search}
              OR "externalId" ILIKE ${search}
            )
          ORDER BY "fullName" ASC
          LIMIT ${take}
        `
      : await prisma().$queryRaw<LegacyParticipantRow[]>`
          SELECT id, "externalId", "fullName", phone, email, "esoName", district, region, sector, status, "createdAt"
          FROM "Participant"
          WHERE "esoName" = ANY(${esoNames})
            AND status = 'active'
          ORDER BY "fullName" ASC
          LIMIT ${take}
        `;

    return participants.map(toLegacyParticipantSummary);
  }
}

export async function getActiveParticipants() {
  try {
    const participants = await prisma().participant.findMany({
      where: { status: "active" },
      orderBy: [{ esoName: "asc" }, { fullName: "asc" }],
    });

    return participants.map(toParticipantSummary);
  } catch (error) {
    if (!isMissingColumnOrTable(error)) throw error;

    const participants = await prisma().$queryRaw<LegacyParticipantRow[]>`
      SELECT id, "externalId", "fullName", phone, email, "esoName", district, region, sector, status, "createdAt"
      FROM "Participant"
      WHERE status = 'active'
      ORDER BY "esoName" ASC, "fullName" ASC
    `;

    return participants.map(toLegacyParticipantSummary);
  }
}

export async function getParticipantDatasets() {
  try {
    const rows = await prisma().participant.findMany({
      where: { status: "active" },
      distinct: ["source"],
      orderBy: { source: "asc" },
      select: { source: true },
    });
    return rows.map((row) => row.source).filter(Boolean);
  } catch (error) {
    if (!isMissingColumnOrTable(error)) {
      try {
        const rows = await prisma().$queryRaw<Array<{ source: string | null }>>`
          SELECT DISTINCT source
          FROM "Participant"
          WHERE status = 'active'
          ORDER BY source ASC
        `;
        return rows.map((row) => row.source).filter(Boolean);
      } catch {
        throw error;
      }
    }

    return ["participant_csv"];
  }
}

export async function getActiveEsos() {
  try {
    return await prisma().eso.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    if (!isMissingColumnOrTable(error)) {
      throw error;
    }

    const participants = await prisma().$queryRaw<Array<{ esoName: string; esoCode: string | null }>>`
      SELECT DISTINCT "esoName", "esoCode"
      FROM "Participant"
      WHERE status = 'active'
      ORDER BY "esoName" ASC
    `;

    return [
      ...new Map(
        participants
          .filter((participant) => participant.esoName.trim())
          .map((participant) => {
            const name = displayEsoName(participant.esoName);
            return [
              name,
              {
                id: "",
                name,
                code: participant.esoCode || "",
                status: "active",
                createdAt: new Date(0),
                updatedAt: new Date(0),
              },
            ];
          }),
      ).values(),
    ];
  }
}

export async function getParticipantsByEsoId(esoId: string, query = "", limit = 5000, dataset = "") {
  const normalizedQuery = normalizeText(query);
  const take = Math.min(Math.max(limit, 1), 5000);

  if (!esoId.trim()) return [];

  try {
    const participants = await prisma().participant.findMany({
      where: {
        esoId,
        status: "active",
        ...(dataset ? { source: dataset } : {}),
        ...(normalizedQuery
          ? {
              OR: [
                { fullName: { contains: normalizedQuery, mode: "insensitive" } },
                { phone: { contains: normalizedQuery } },
                { email: { contains: normalizedQuery, mode: "insensitive" } },
                { externalId: { contains: normalizedQuery, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ fullName: "asc" }],
      take,
    });

    return participants.map(toParticipantSummary);
  } catch (error) {
    if (!isMissingColumnOrTable(error)) throw error;

    const search = `%${normalizedQuery}%`;
    const participants = normalizedQuery
      ? await prisma().$queryRaw<LegacyParticipantRow[]>`
          SELECT id, "externalId", "fullName", phone, email, "esoName", district, region, sector, status, "createdAt"
          FROM "Participant"
          WHERE "esoId" = ${esoId}
            AND status = 'active'
            AND (
              "fullName" ILIKE ${search}
              OR phone LIKE ${search}
              OR email ILIKE ${search}
              OR "externalId" ILIKE ${search}
            )
          ORDER BY "fullName" ASC
          LIMIT ${take}
        `
      : await prisma().$queryRaw<LegacyParticipantRow[]>`
          SELECT id, "externalId", "fullName", phone, email, "esoName", district, region, sector, status, "createdAt"
          FROM "Participant"
          WHERE "esoId" = ${esoId}
            AND status = 'active'
          ORDER BY "fullName" ASC
          LIMIT ${take}
        `;

    return participants.map(toLegacyParticipantSummary);
  }
}

export async function getParticipantByIdForSelection(participantId: string, esoIdOrName: string) {
  if (!participantId.trim() || !esoIdOrName.trim()) return null;
  const esoNames = esoSearchNames(esoIdOrName);

  try {
    const participant = await prisma().participant.findFirst({
      where: {
        id: participantId,
        status: "active",
        OR: [{ esoId: esoIdOrName }, { esoName: { in: esoNames } }],
      },
    });

    return participant ? toParticipantSummary(participant) : null;
  } catch (error) {
    if (!isMissingColumnOrTable(error)) throw error;

    const participants = await prisma().$queryRaw<LegacyParticipantRow[]>`
      SELECT id, "externalId", "fullName", phone, email, "esoName", district, region, sector, status, "createdAt"
      FROM "Participant"
      WHERE id = ${participantId}
        AND "esoName" = ANY(${esoNames})
        AND status = 'active'
      LIMIT 1
    `;

    return participants[0] ? toLegacyParticipantSummary(participants[0]) : null;
  }
}

export async function getParticipantForConsent(participantId: string, esoId: string) {
  if (!participantId.trim() || !esoId.trim()) return null;
  const esoNames = esoSearchNames(esoId);

  try {
    return prisma().participant.findFirst({
      where: {
        id: participantId,
        status: "active",
        OR: [{ esoId }, { esoName: { in: esoNames } }],
      },
      include: {
        eso: true,
      },
    });
  } catch (error) {
    if (!isMissingColumnOrTable(error)) throw error;

    const participants = await prisma().$queryRaw<Array<Participant & { eso: null }>>`
      SELECT *, NULL as eso
      FROM "Participant"
      WHERE id = ${participantId}
        AND "esoName" = ANY(${esoNames})
        AND status = 'active'
      LIMIT 1
    `;

    return participants[0] || null;
  }
}
