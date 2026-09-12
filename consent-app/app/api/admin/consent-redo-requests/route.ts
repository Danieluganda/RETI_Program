import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { userByToken } from "@/lib/auth";
import { getConsentRedoRequests, reviewConsentRedoRequest } from "@/lib/db";

async function adminUser() {
  const cookieStore = await cookies();
  const user = userByToken(cookieStore.get("consent_auth")?.value);
  return user?.role === "admin" ? user : null;
}

export async function GET(request: Request) {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  return NextResponse.json({ requests: await getConsentRedoRequests(status) });
}

export async function PATCH(request: Request) {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json();
  const id = String(body.id || "").trim();
  const status = String(body.status || "").trim();
  const reviewNote = String(body.reviewNote || "").trim();

  if (!id || (status !== "approved" && status !== "rejected")) {
    return NextResponse.json({ error: "Request id and approval decision are required." }, { status: 422 });
  }

  const redoRequest = await reviewConsentRedoRequest(id, status, user.name, reviewNote);
  if (!redoRequest) return NextResponse.json({ error: "Redo request not found." }, { status: 404 });

  return NextResponse.json({ redoRequest });
}
