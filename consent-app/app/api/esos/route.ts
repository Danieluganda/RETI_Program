import { NextResponse } from "next/server";
import { withTimeout } from "@/lib/asyncTimeout";
import { getConsents } from "@/lib/db";
import { getActiveEsos } from "@/lib/participants";

export const dynamic = "force-dynamic";

type EsoOption = {
  id: string;
  name: string;
  code: string;
};

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
  let esos: EsoOption[] = (await withTimeout(getActiveEsos(), 2000).catch(() => [])).map((eso) => ({
    id: eso.id,
    name: eso.name,
    code: eso.code || "",
  }));
  if (!esos.length) {
    const records = await withTimeout(getConsents(), 2000).catch(() => []);
    esos = [
      ...new Set(records.map((record) => record.esoName).filter(Boolean)),
    ]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: "", name, code: "" }));
  }
  if (!esos.length) esos = fallbackEsos;

  return NextResponse.json({
    esos,
  });
}
