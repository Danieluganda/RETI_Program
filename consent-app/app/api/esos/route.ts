import { NextResponse } from "next/server";
import { withTimeout } from "@/lib/asyncTimeout";
import { getActiveEsos } from "@/lib/participants";

export const dynamic = "force-dynamic";

const fallbackEsos = [
  "AGDI",
  "AID",
  "Challenges Uganda",
  "CURAD",
  "DFCU Foundation",
  "ECHAI/Excelhort",
  "Finding XY",
  "Living Earth Uganda",
  "Mkazipreneur",
  "MUBS EIC",
  "PEDN",
  "Stanbic Bank Incubator",
].map((name) => ({ id: "", name, code: "" }));

export async function GET() {
  const esos = await withTimeout(getActiveEsos()).catch(() => fallbackEsos);

  return NextResponse.json({
    esos: esos.map((eso) => ({
      id: eso.id,
      name: eso.name,
      code: eso.code || "",
    })),
  });
}
