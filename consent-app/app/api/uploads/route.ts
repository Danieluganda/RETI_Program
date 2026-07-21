import { readFile } from "node:fs/promises";
import { join, normalize, relative } from "node:path";
import { NextResponse } from "next/server";
import { privateFileRoot } from "@/lib/storage";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("key") || url.searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const filePath = normalize(join(privateFileRoot, file));
  if (relative(privateFileRoot, filePath).startsWith("..")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readFile(filePath);
  const contentType = file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return new NextResponse(bytes, { headers: { "Content-Type": contentType } });
}
