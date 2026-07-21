import { BlobServiceClient } from "@azure/storage-blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative } from "node:path";

export const privateFileRoot = join(process.cwd(), "private-consent-files");
export const generatedPdfRoot = join(process.cwd(), "generated-pdfs");

const blobConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobContainerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "consent-files";
const useBlobStorage = Boolean(blobConnectionString);

export function hasBlobStorage() {
  return useBlobStorage;
}

function safePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function containerClient() {
  if (!blobConnectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured.");
  return BlobServiceClient.fromConnectionString(blobConnectionString).getContainerClient(blobContainerName);
}

async function uploadBuffer(fileKey: string, buffer: Buffer, contentType: string) {
  const container = containerClient();
  await container.createIfNotExists();
  await container.getBlockBlobClient(fileKey).uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

export function consentFolderKey(reference: string) {
  const now = new Date();
  return `10x/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${reference}`;
}

export async function saveDataImage(reference: string, label: string, dataUrl?: string) {
  if (!dataUrl?.startsWith("data:image/")) return "";

  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!match) return "";

  const folderKey = consentFolderKey(reference);
  const ext = match[1] === "jpeg" ? "jpg" : "png";
  const fileName = `${safePart(label)}.${ext}`;
  const fileKey = `${folderKey}/${fileName}`;
  const buffer = Buffer.from(match[2], "base64");

  if (useBlobStorage) {
    await uploadBuffer(fileKey, buffer, ext === "jpg" ? "image/jpeg" : "image/png");
    return fileKey;
  }

  const folderPath = join(privateFileRoot, folderKey);
  await mkdir(folderPath, { recursive: true });
  await writeFile(join(folderPath, fileName), buffer);

  return fileKey;
}

export async function savePdfFile(folderKey: string, bytes: Uint8Array) {
  const pdfKey = `${folderKey}/consent-form.pdf`;
  const buffer = Buffer.from(bytes);

  if (useBlobStorage) {
    await uploadBuffer(pdfKey, buffer, "application/pdf");
    return pdfKey;
  }

  const privatePath = privateFilePath(pdfKey);
  const archivePath = generatedPdfPath(pdfKey);
  await mkdir(dirname(privatePath), { recursive: true });
  await mkdir(dirname(archivePath), { recursive: true });
  await writeFile(privatePath, buffer);
  await writeFile(archivePath, buffer);
  return pdfKey;
}

export async function readPrivateFile(fileKey: string) {
  if (useBlobStorage) {
    const blob = containerClient().getBlobClient(fileKey);
    const data = await blob.downloadToBuffer();
    return Buffer.from(data);
  }

  return readFile(privateFilePath(fileKey));
}

export async function readTextBlob(fileKey: string) {
  const blob = containerClient().getBlobClient(fileKey);
  const data = await blob.downloadToBuffer();
  return data.toString("utf8");
}

export async function writeTextBlob(fileKey: string, text: string) {
  await uploadBuffer(fileKey, Buffer.from(text, "utf8"), "application/json");
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
