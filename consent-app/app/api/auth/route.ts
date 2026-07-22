import { NextResponse } from "next/server";
import { validateLogin } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const user = validateLogin(body.email, body.password);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json({ user, token: `demo-token-${user.id}` });
  response.cookies.set("consent_auth", `demo-token-${user.id}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("consent_auth", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
