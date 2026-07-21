import { mkdir, writeFile } from "node:fs/promises";
import { join, normalize, relative } from "node:path";

export const privateFileRoot = join(process.cwd(), "private-consent-files");
export const generatedPdfRoot = join(process.cwd(), "generated-pdfs");

function safePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function saveDataImage(reference: string, label: string, dataUrl?: string) {
  if (!dataUrl?.startsWith("data:image/")) return "";

  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!match) return "";

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const folderKey = `10x/${year}/${month}/${reference}`;
  const folderPath = join(privateFileRoot, folderKey);
  await mkdir(folderPath, { recursive: true });

  const ext = match[1] === "jpeg" ? "jpg" : "png";
  const fileName = `${safePart(label)}.${ext}`;
  const fileKey = `${folderKey}/${fileName}`;
  await writeFile(join(folderPath, fileName), Buffer.from(match[2], "base64"));

  return fileKey;
}

export function fileUrl(fileKey: string) {
  return fileKey ? `/api/uploads?key=${encodeURIComponent(fileKey)}` : "";
}

export function privateFilePath(fileKey: string) {
  const filePath = normalize(join(privateFileRoot, fileKey));

  if (relative(privateFileRoot, filePath).startsWith("..")) {
    throw new Error("Invalid private file key");
  }

  return filePath;
}

export function generatedPdfPath(fileKey: string) {
  const filePath = normalize(join(generatedPdfRoot, fileKey));

  if (relative(generatedPdfRoot, filePath).startsWith("..")) {
    throw new Error("Invalid generated PDF file key");
  }

  return filePath;
}
