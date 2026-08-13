import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await runIngest();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Ingest failed:", err);
    return NextResponse.json({ error: `Не удалось обновить данные: ${message}` }, { status: 500 });
  }
}
