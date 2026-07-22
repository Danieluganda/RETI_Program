const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const unmatched = [];
  const esoByName = new Map();
  let linkedParticipants = 0;
  let linkedConsents = 0;

  const participantEsos = await prisma.participant.groupBy({
    by: ["esoName"],
    where: { esoName: { not: "" } },
  });

  for (const item of participantEsos) {
    const name = item.esoName;
    const eso = await prisma.eso.upsert({
      where: { name },
      create: {
        name,
        code: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || null,
      },
      update: { status: "active" },
    });
    esoByName.set(name, eso);
  }

  const participants = await prisma.participant.findMany({ where: { esoId: null } });
  for (const participant of participants) {
    const eso = esoByName.get(participant.esoName);
    if (!eso) continue;

    await prisma.participant.update({
      where: { id: participant.id },
      data: { esoId: eso.id },
    });
    linkedParticipants += 1;
  }

  const consents = await prisma.consent.findMany({ where: { participantId: null } });
  for (const consent of consents) {
    if (!consent.participantExternalId) {
      unmatched.push({
        referenceNumber: consent.referenceNumber,
        reason: "missing participantExternalId",
        participantName: consent.participantName,
        esoName: consent.esoName || "",
      });
      continue;
    }

    const participant = await prisma.participant.findUnique({
      where: { externalId: consent.participantExternalId },
      include: { eso: true },
    });

    if (!participant || !participant.esoId) {
      unmatched.push({
        referenceNumber: consent.referenceNumber,
        reason: "no unique participant match by participantExternalId",
        participantExternalId: consent.participantExternalId,
        participantName: consent.participantName,
        esoName: consent.esoName || "",
      });
      continue;
    }

    await prisma.consent.update({
      where: { id: consent.id },
      data: {
        participantId: participant.id,
        esoId: participant.esoId,
        participantName: consent.participantName || participant.fullName,
        participantPhone: consent.participantPhone || participant.phone || "",
        esoName: consent.esoName || participant.eso?.name || participant.esoName,
        pdfStatus: consent.pdfFileKey ? "generated" : "missing",
        status: consent.status === "locked" ? "finalized" : consent.status,
      },
    });
    linkedConsents += 1;
  }

  const reportPath = path.join(process.cwd(), "private", "v2-unmatched-consents.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(unmatched, null, 2)}\n`);

  console.log(JSON.stringify({ linkedParticipants, linkedConsents, unmatchedConsents: unmatched.length, unmatchedReport: reportPath }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
