const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const csvPath = process.argv[2] || path.join(process.cwd(), "_src_data", "particant_data.csv");

const esoAliases = {
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function clean(value = "") {
  return String(value).replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
}

function normalizeName(value = "") {
  return clean(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePhone(value = "") {
  const cleaned = clean(value);
  if (!cleaned) return "";
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return cleaned;
  if (digits.startsWith("256")) return `+${digits}`;
  if (digits.length === 9) return `+256${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+256${digits.slice(1)}`;
  return cleaned.startsWith("+") ? cleaned : `+${digits}`;
}

function normalizeEso(value = "") {
  const cleaned = clean(value);
  const key = cleaned.toLowerCase().replace(/[^a-z]/g, "");

  for (const [alias, eso] of Object.entries(esoAliases)) {
    if (key.includes(alias)) return eso;
  }

  return cleaned;
}

function pick(row, header, startsWith) {
  const key = header.find((item) => item.startsWith(startsWith));
  return key ? row[key] : "";
}

async function main() {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const [headerRow, ...dataRows] = parseCsv(text);
  const header = headerRow.map(clean);
  const participants = [];
  const seenExternalIds = new Set();
  const duplicateExternalIds = new Set();
  let skipped = 0;
  let invalid = 0;
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const esos = new Map();

  for (const values of dataRows) {
    const row = Object.fromEntries(header.map((key, index) => [key, values[index] || ""]));
    const firstName = clean(pick(row, header, "First Name"));
    const middleName = clean(pick(row, header, "Middle Name"));
    const surname = clean(pick(row, header, "Surname"));
    const preferredName = clean(pick(row, header, "Preferred Name"));
    const fullName = normalizeName(preferredName || [firstName, middleName, surname].filter(Boolean).join(" "));
    const externalId = clean(pick(row, header, "Unique identifier")) || clean(row["Unique Key"]);
    const esoCode = clean(row.ESO_name);
    const esoName = normalizeEso(esoCode);

    if (!fullName || !esoName) {
      skipped += 1;
      invalid += 1;
      continue;
    }

    const stableExternalId = externalId || `${esoName}:${fullName}`;
    if (seenExternalIds.has(stableExternalId)) {
      duplicateExternalIds.add(stableExternalId);
      skipped += 1;
      continue;
    }
    seenExternalIds.add(stableExternalId);

    participants.push({
      externalId: stableExternalId,
      fullName,
      normalizedName: fullName.toLowerCase(),
      phone: normalizePhone(pick(row, header, "Primary Phone Number")),
      email: clean(row.Email),
      esoName,
      esoCode,
      district: clean(pick(row, header, "Administrative Level2")),
      region: clean(pick(row, header, "Administrative Level1")),
      sector: clean(pick(row, header, "Sector")),
      status: "active",
    });

    esos.set(esoName, (esos.get(esoName) || 0) + 1);
  }

  const esoByName = new Map();
  const hasEsoTable =
    Number(
      (
        await prisma.$queryRawUnsafe(
          "SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'Eso'",
        )
      )[0]?.count || 0,
    ) > 0;
  const hasParticipantEsoId =
    Number(
      (
        await prisma.$queryRawUnsafe(
          "SELECT count(*)::int as count FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Participant' AND column_name = 'esoId'",
        )
      )[0]?.count || 0,
    ) > 0;

  if (hasEsoTable) {
    for (const [name] of esos) {
      const eso = await prisma.eso.upsert({
        where: { name },
        create: {
          name,
          code: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || null,
        },
        update: {
          status: "active",
        },
      });
      esoByName.set(name, eso);
    }
  }

  for (const participant of participants) {
    const eso = esoByName.get(participant.esoName);
    if (hasParticipantEsoId && !eso) {
      skipped += 1;
      invalid += 1;
      continue;
    }

    const nextData = hasParticipantEsoId ? { ...participant, esoId: eso.id } : participant;
    const existing = (
      await prisma.$queryRawUnsafe(
        'SELECT id, "fullName", "normalizedName", phone, email, "esoName", "esoCode", district, region, sector, status FROM "Participant" WHERE "externalId" = $1 LIMIT 1',
        participant.externalId,
      )
    )[0];

    if (!existing) {
      if (hasParticipantEsoId) {
        await prisma.participant.create({ data: nextData });
      } else {
        await prisma.$executeRawUnsafe(
          'INSERT INTO "Participant" ("id", "externalId", "fullName", "normalizedName", phone, email, "esoName", "esoCode", district, region, sector, status, source, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())',
          randomUUID(),
          participant.externalId,
          participant.fullName,
          participant.normalizedName,
          participant.phone,
          participant.email,
          participant.esoName,
          participant.esoCode,
          participant.district,
          participant.region,
          participant.sector,
          participant.status,
          "participant_csv",
        );
      }
      created += 1;
      continue;
    }

    const comparableExisting = {
      fullName: existing.fullName,
      normalizedName: existing.normalizedName,
      phone: existing.phone || "",
      email: existing.email || "",
      esoName: existing.esoName,
      esoCode: existing.esoCode || "",
      district: existing.district || "",
      region: existing.region || "",
      sector: existing.sector || "",
      status: existing.status,
    };
    const comparableNext = {
      fullName: nextData.fullName,
      normalizedName: nextData.normalizedName,
      phone: nextData.phone || "",
      email: nextData.email || "",
      esoName: nextData.esoName,
      esoCode: nextData.esoCode || "",
      district: nextData.district || "",
      region: nextData.region || "",
      sector: nextData.sector || "",
      status: nextData.status,
    };

    if (JSON.stringify(comparableExisting) === JSON.stringify(comparableNext)) {
      unchanged += 1;
      continue;
    }

    if (hasParticipantEsoId) {
      await prisma.participant.update({
        where: { externalId: participant.externalId },
        data: nextData,
      });
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE "Participant" SET "fullName"=$1, "normalizedName"=$2, phone=$3, email=$4, "esoName"=$5, "esoCode"=$6, district=$7, region=$8, sector=$9, status=$10, "updatedAt"=now() WHERE "externalId"=$11',
        participant.fullName,
        participant.normalizedName,
        participant.phone,
        participant.email,
        participant.esoName,
        participant.esoCode,
        participant.district,
        participant.region,
        participant.sector,
        participant.status,
        participant.externalId,
      );
    }
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        totalRowsRead: dataRows.length,
        created,
        updated,
        unchanged,
        skipped,
        invalid,
        duplicateExternalIds: duplicateExternalIds.size,
        activeParticipants: Number(
          (
            await prisma.$queryRawUnsafe('SELECT count(*)::int as count FROM "Participant" WHERE status = \'active\'')
          )[0]?.count || 0,
        ),
        esos: Object.fromEntries(esos),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
