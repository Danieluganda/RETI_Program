const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT
      p.id,
      p."externalId",
      p."fullName",
      p.phone,
      p.email,
      p."esoName",
      p.district,
      p.region,
      p.sector,
      p.status,
      COALESCE(c."referenceNumber", '') AS "consentReference",
      COALESCE(c."consentDecision", '') AS "consentDecision",
      c."createdAt" AS "consentCreatedAt"
    FROM "Participant" p
    LEFT JOIN LATERAL (
      SELECT "referenceNumber", "consentDecision", "createdAt"
      FROM "Consent" c
      WHERE c."participantId" = p.id
        AND c."status" IN ('locked', 'finalized')
        AND c."supersededById" IS NULL
      ORDER BY c."createdAt" DESC
      LIMIT 1
    ) c ON true
    WHERE p.status = 'active'
      AND (
        p.district ILIKE '%gulu%'
        OR p.region ILIKE '%gulu%'
        OR p.region ILIKE '%north%'
        OR p.district ILIKE '%north%'
      )
    ORDER BY p."esoName", p.district, p."fullName"
  `;

  const headers = [
    "externalId",
    "fullName",
    "phone",
    "email",
    "esoName",
    "district",
    "region",
    "sector",
    "status",
    "consentReference",
    "consentDecision",
    "consentCreatedAt",
  ];
  const outputPath = path.join(process.cwd(), "gulu-northern-participants.csv");
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => csvCell(row[header] instanceof Date ? row[header].toISOString() : row[header]))
        .join(","),
    ),
  ];
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  const counts = {
    total: rows.length,
    consentedOrDeclined: 0,
    pendingConsent: 0,
    byEso: {},
    byDistrict: {},
  };

  for (const row of rows) {
    counts.byEso[row.esoName || "Unknown"] = (counts.byEso[row.esoName || "Unknown"] || 0) + 1;
    counts.byDistrict[row.district || "Unknown"] = (counts.byDistrict[row.district || "Unknown"] || 0) + 1;
    if (row.consentReference) counts.consentedOrDeclined += 1;
    else counts.pendingConsent += 1;
  }

  console.log(JSON.stringify({ outputPath, counts, preview: rows.slice(0, 30) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
