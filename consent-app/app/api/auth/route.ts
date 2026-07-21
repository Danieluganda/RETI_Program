import { NextResponse } from "next/server";
import { validateLogin } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const user = validateLogin(body.email, body.password);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  return NextResponse.json({ user, token: `demo-token-${user.id}` });
}
