import { NextResponse } from "next/server";
import { readPrivateFile } from "@/lib/storage";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("key") || url.searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.includes("..") || file.startsWith("/") || file.startsWith("\\")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readPrivateFile(file);
  const contentType = file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return new NextResponse(bytes, { headers: { "Content-Type": contentType } });
}
