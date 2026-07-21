import { readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { ConsentRecord } from "./db";
import { generatedPdfPath, privateFilePath, privateFileRoot } from "./storage";

const pageSize: [number, number] = [595.28, 841.89];
const marginX = 52;
const topY = 776;
const bottomY = 56;
const contentW = pageSize[0] - marginX * 2;

type PdfContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  signFont: PDFFont;
  y: number;
};

function isPartner(record: ConsentRecord) {
  return record.consentFormType === "third-party-data-sharing";
}

function titleFor(record: ConsentRecord) {
  return isPartner(record) ? "Third-Party Partner Data Sharing Consent Form" : "Program Participants Consent Form";
}

function fieldValue(value: string | undefined, fallback = "N/A") {
  return value?.trim() ? value : fallback;
}

function organizationFor(record: ConsentRecord) {
  return fieldValue(record.implementingOrganization, isPartner(record) ? "10X Program" : "Mastercard Foundation");
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function addPage(ctx: PdfContext) {
  ctx.page = ctx.pdfDoc.addPage(pageSize);
  ctx.y = topY;
}

function ensureSpace(ctx: PdfContext, height: number) {
  if (ctx.y - height < bottomY) addPage(ctx);
}

function textBlock(
  ctx: PdfContext,
  text: string,
  options: { x?: number; width?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; lineGap?: number } = {},
) {
  const x = options.x || marginX;
  const width = options.width || contentW;
  const size = options.size || 10;
  const font = options.bold ? ctx.bold : ctx.font;
  const lineGap = options.lineGap ?? 4;
  const lines = wrapText(text, font, size, width);
  ensureSpace(ctx, lines.length * (size + lineGap));

  for (const line of lines) {
    ctx.page.drawText(line, {
      x,
      y: ctx.y,
      size,
      font,
      color: options.color || rgb(0.12, 0.16, 0.2),
    });
    ctx.y -= size + lineGap;
  }
}

function section(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 34);
  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: marginX, y: ctx.y },
    end: { x: pageSize[0] - marginX, y: ctx.y },
    thickness: 0.7,
    color: rgb(0.83, 0.88, 0.9),
  });
  ctx.y -= 17;
  textBlock(ctx, title, { size: 12, bold: true, color: rgb(0.04, 0.31, 0.29) });
}

function fieldLine(ctx: PdfContext, label: string, value: string, x: number, y: number, width: number) {
  ctx.page.drawText(label, { x, y, size: 8.5, font: ctx.bold, color: rgb(0.18, 0.25, 0.3) });
  ctx.page.drawText(value || " ", { x, y: y - 18, size: 10, font: ctx.font, color: rgb(0.08, 0.11, 0.14) });
  ctx.page.drawLine({
    start: { x, y: y - 22 },
    end: { x: x + width, y: y - 22 },
    thickness: 0.7,
    color: rgb(0.38, 0.45, 0.49),
  });
}

function fieldGrid(ctx: PdfContext, rows: Array<[string, string]>) {
  const gap = 18;
  const colW = (contentW - gap) / 2;

  for (let i = 0; i < rows.length; i += 2) {
    ensureSpace(ctx, 46);
    const y = ctx.y;
    fieldLine(ctx, rows[i][0], rows[i][1], marginX, y, colW);
    if (rows[i + 1]) fieldLine(ctx, rows[i + 1][0], rows[i + 1][1], marginX + colW + gap, y, colW);
    ctx.y -= 46;
  }
}

function bulletList(ctx: PdfContext, items: string[]) {
  for (const item of items) textBlock(ctx, `- ${item}`, { size: 9.5, x: marginX + 10, width: contentW - 10 });
}

function checkbox(ctx: PdfContext, checked: boolean, text: string) {
  ensureSpace(ctx, 30);
  const boxY = ctx.y - 2;
  ctx.page.drawRectangle({
    x: marginX,
    y: boxY,
    width: 10,
    height: 10,
    borderColor: rgb(0.35, 0.44, 0.48),
    borderWidth: 0.8,
  });
  if (checked) {
    ctx.page.drawText("X", { x: marginX + 1.8, y: boxY + 1.2, size: 8, font: ctx.bold, color: rgb(0.04, 0.31, 0.29) });
  }
  textBlock(ctx, text, { x: marginX + 18, width: contentW - 18, size: 9.5 });
  ctx.y -= 4;
}

async function embedImage(ctx: PdfContext, fileKey: string) {
  if (!fileKey) return null;
  try {
    const bytes = await readFile(privateFilePath(fileKey));
    const lower = basename(fileKey).toLowerCase();
    return lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? ctx.pdfDoc.embedJpg(bytes) : ctx.pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

function signatureFallbackName(name: string) {
  return name
    .trim()
    .toLowerCase();
}

function drawImageBox(ctx: PdfContext, label: string, image: PDFImage | null, fallbackName: string) {
  ensureSpace(ctx, 100);
  ctx.page.drawText(label, { x: marginX, y: ctx.y, size: 9.5, font: ctx.bold, color: rgb(0.18, 0.25, 0.3) });
  ctx.y -= 12;
  const boxX = marginX;
  const lineY = ctx.y - 72;
  const boxW = contentW;
  const boxH = 64;
  ctx.page.drawLine({
    start: { x: boxX, y: lineY },
    end: { x: boxX + boxW, y: lineY },
    thickness: 0.8,
    color: rgb(0.38, 0.45, 0.49),
  });

  if (image) {
    const scaled = image.scaleToFit(boxW - 20, boxH - 16);
    ctx.page.drawImage(image, {
      x: boxX + (boxW - scaled.width) / 2,
      y: lineY + 8,
      width: scaled.width,
      height: scaled.height,
    });
  } else {
    const signedName = signatureFallbackName(fallbackName);
    if (signedName) {
      const size = 15;
      const nameWidth = ctx.signFont.widthOfTextAtSize(signedName, size);
      ctx.page.drawText(signedName, {
        x: boxX + (boxW - nameWidth) / 2,
        y: lineY + 12,
        size,
        font: ctx.signFont,
        color: rgb(0.08, 0.24, 0.55),
      });
    }
  }

  ctx.y = lineY - 16;
}

function dataCollected(record: ConsentRecord) {
  if (isPartner(record)) {
    return record.dataShared.length
      ? record.dataShared
      : ["Participant name", "Phone number", "Program participation status", "Service request details"];
  }

  return [
    "Name, age, and gender",
    "Contact details",
    "Participation details in the Program",
    "Level of Education",
    "Marital status",
    "Refugee or displaced persons status",
    "Presence of a disability",
    "Feedback and responses to surveys",
  ];
}

function sharingParties(record: ConsentRecord) {
  if (isPartner(record)) {
    return record.authorizedPartners.length
      ? record.authorizedPartners
      : [
          "Approved device financing partners",
          "Approved digital credit or financial service partners",
          "Approved device, asset, or connectivity service providers",
          "Third-party data processors supporting partner onboarding, verification, storage, analysis, servicing, or reporting.",
        ];
  }

  return [
    "Mastercard Foundation",
    "Third-party data processors hired by Mastercard Foundation to assist with monitoring and evaluation, for example data storage and analysis organizations.",
  ];
}

function intro(record: ConsentRecord) {
  if (isPartner(record)) {
    return `${organizationFor(record)} requests your consent to share selected personal and program participation data with approved third-party partners who may provide participant support services such as device financing, digital credit, asset financing, affordability checks, onboarding, verification, servicing, and related support. Please read this form carefully and sign to indicate your consent.`;
  }

  return `${organizationFor(record)} is committed to improving its programs and ensuring they have a positive impact on program participants. To achieve this, we collect and analyze data about program participants. We value your privacy and are committed to protecting your personal data. This consent form explains how we collect, use, and share your personal information as part of the 10X Program. Please read this form carefully and sign to indicate your consent.`;
}

function purpose(record: ConsentRecord) {
  if (isPartner(record)) {
    return "We collect and share your selected data only to help third-party partners assess eligibility, provide offers or services, verify your identity or participation, manage service delivery, and communicate with you about partner products or support that may be relevant to your participation in the program.";
  }

  return "We collect your personal data to make analysis on the progress of the Program and improve the Program and learn from the data collected, including monitoring and evaluating the effectiveness of the 10X Program and to learn how to improve it for future participants.";
}

function choiceText(record: ConsentRecord) {
  if (isPartner(record)) {
    return "By consenting to this data sharing, you allow approved partners to contact you and process your data for the partner services described above. Refusing this consent will not stop your participation in the core program.";
  }

  return "By consenting to share your data, you are helping for the success of the 10X Program for you and future participants.";
}

function agreementText(record: ConsentRecord) {
  if (isPartner(record)) {
    return `I agree to share my data with ${fieldValue(record.dataSharingOrganization, "approved third-party partners")}, including device financiers, digital credit providers, asset financing partners, and their processors for the purposes described above.`;
  }

  return `I agree to share my data with ${fieldValue(record.dataSharingOrganization)} and Mastercard Foundation as well as any third-party data processors they may use for the purposes described above.`;
}

export async function generateConsentPdf(record: ConsentRecord) {
  const generatedAt = new Date().toISOString();
  const referenceParts = record.signatureFileKey.split("/").slice(0, 4);
  const now = new Date();
  const folderKey =
    referenceParts.length === 4
      ? referenceParts.join("/")
      : `10x/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${record.referenceNumber}`;
  const folderPath = join(privateFileRoot, folderKey);
  await mkdir(folderPath, { recursive: true });

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const signFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const ctx: PdfContext = { pdfDoc, page: pdfDoc.addPage(pageSize), font, bold, signFont, y: topY };
  const participantImage = await embedImage(ctx, record.signatureFileKey);
  const interpreterImage = await embedImage(ctx, record.interpreterSignatureFileKey);

  textBlock(ctx, "10X Program", { size: 26, bold: true, color: rgb(0.04, 0.31, 0.29), lineGap: 6 });
  textBlock(ctx, titleFor(record), { size: 12, bold: true, lineGap: 5 });
  textBlock(ctx, `Reference: ${record.referenceNumber} | Version: ${record.consentFormVersion} | Status: ${record.status}`, {
    size: 9,
    color: rgb(0.36, 0.43, 0.48),
  });
  ctx.y -= 8;

  section(ctx, "Consent Form");
  textBlock(ctx, intro(record), { size: 10 });
  textBlock(ctx, "Please read this form carefully before you decide.", { size: 9.5, bold: true, color: rgb(0.36, 0.43, 0.48) });

  section(ctx, "Program and Collector Details");
  fieldGrid(ctx, [
    ["Program name", record.programName],
    ["Data collector organization", record.dataCollectorOrganization],
    ["Data collector name", record.collectorName],
    ["Data collector contact information", record.dataCollectorContact],
  ]);

  if (isPartner(record)) {
    section(ctx, "Partner Service Request");
    fieldGrid(ctx, [["Service required", fieldValue(record.serviceRequired)]]);
    textBlock(ctx, "Authorized partner(s)", { size: 10, bold: true });
    bulletList(ctx, sharingParties(record));
  }

  section(ctx, "1. Purpose of Data Collection and Use");
  textBlock(ctx, purpose(record), { size: 10 });

  section(ctx, "2. What Data Do We Collect?");
  textBlock(ctx, "We may collect some or all of the following information about you:", { size: 10 });
  bulletList(ctx, dataCollected(record));

  section(ctx, "3. Who Will Your Data Be Shared With?");
  textBlock(ctx, "We may share your data with the following parties:", { size: 10 });
  bulletList(ctx, sharingParties(record));
  textBlock(ctx, `For additional information on how ${fieldValue(record.privacyOrganization)} processes personal data, please visit ${fieldValue(record.privacyPolicyUrl)} to access a copy of its privacy policy.`, { size: 9.5 });
  textBlock(ctx, "The Foundation's privacy policy can be accessed via https://mastercardfdn.org/privacy/", { size: 9.5 });

  section(ctx, "4. Your Rights");
  textBlock(
    ctx,
    "You are not obligated to give your consent. You are eligible to participate in all aspects of the program, regardless of your decision to share your data. Consent to data sharing is entirely separate from program participation. You have the following rights regarding your personal data:",
    { size: 10 },
  );
  bulletList(ctx, [
    "Right to access: You have the right to request a copy of the information we hold about you.",
    "Right to rectification: You have the right to ask us to correct any inaccurate information we hold about you.",
    "Right to erasure: You have the right to ask us to delete your information.",
    "Right to restriction of processing: You have the right to ask us to restrict the processing of your information.",
    "Right to object to processing: You have the right to object to the processing of your information.",
    "Right to data portability: You have the right to request that your data be transferred to another organization.",
  ]);

  section(ctx, "5. Withdrawing Your Consent");
  textBlock(ctx, "You can withdraw your consent to share your data at any time. This will not affect your ability to participate in the program. To withdraw your consent, please contact:", { size: 10 });
  fieldGrid(ctx, [["Withdrawal contact", record.withdrawalContact]]);

  section(ctx, "6. Understanding Your Choices");
  textBlock(ctx, choiceText(record), { size: 10 });
  checkbox(ctx, record.informationUnderstood, agreementText(record));

  if (isPartner(record)) {
    section(ctx, "7. Accept or Decline Partner Data Sharing");
    checkbox(ctx, record.consentDecision === "consented", "I accept sharing the listed data with the selected partner(s).");
    checkbox(ctx, record.consentDecision === "declined", "I decline sharing my data with third-party partners.");
  }

  section(ctx, "Participant Confirmation");
  fieldGrid(ctx, [
    ["Participant name (printed)", record.participantName],
    ["Date", record.consentDate],
    ["Signing method", record.signingMethod],
    ["Collector's name", record.collectorName],
  ]);
  drawImageBox(ctx, "Participant signature or thumbprint", participantImage, record.participantName);

  section(ctx, "Interpreter Confirmation");
  textBlock(
    ctx,
    `I ${fieldValue(record.interpreterName, "N/A")} of ${fieldValue(record.interpreterOrganization, "N/A")} have distinctly, clearly and audibly interpreted/read the above in the ${fieldValue(record.interpreterLanguage, "N/A")} language/dialect to the abovenamed person who seemed to clearly understand the above and who made his/her mark in my presence.`,
    { size: 10 },
  );
  fieldGrid(ctx, [
    ["Date", record.consentDate],
    ["Interpreter name for signature record", fieldValue(record.interpreterName, "")],
  ]);
  drawImageBox(ctx, "Interpreter signature", interpreterImage, record.interpreterName);

  section(ctx, "Locked Record Metadata");
  fieldGrid(ctx, [
    ["Consent date and time", record.createdAt],
    ["PDF generated at", generatedAt],
    ["Unique consent reference number", record.referenceNumber],
    ["Consent form version", record.consentFormVersion],
  ]);

  const pdfKey = `${folderKey}/consent-form.pdf`;
  const pdfBytes = await pdfDoc.save();
  const archivePath = generatedPdfPath(pdfKey);
  await mkdir(dirname(archivePath), { recursive: true });
  await writeFile(join(folderPath, "consent-form.pdf"), pdfBytes);
  await writeFile(archivePath, pdfBytes);

  return { pdfFileKey: pdfKey, pdfFile: `/api/uploads?key=${encodeURIComponent(pdfKey)}`, pdfGeneratedAt: generatedAt };
}
