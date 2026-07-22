import { NextResponse } from "next/server";
import { getActiveEsos } from "@/lib/participants";

export const dynamic = "force-dynamic";

export async function GET() {
  const esos = await getActiveEsos();

  return NextResponse.json({
    esos: esos.map((eso) => ({
      id: eso.id,
      name: eso.name,
      code: eso.code || "",
    })),
  });
}
