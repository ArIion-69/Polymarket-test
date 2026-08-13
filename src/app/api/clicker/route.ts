import { NextResponse } from "next/server";
import { persistClicker, loadClicker, logEvent, logPurchase } from "@/lib/clicker/store";
import type { ClickerState } from "@/lib/clicker/economy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const data = await loadClicker();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action?: string;
    state?: ClickerState;
    key?: string;
    cost?: number;
    event?: { kind: string; title: string; detail: string };
  };

  if (body.action === "save" && body.state) {
    await persistClicker(body.state);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "buy" && body.key) {
    if (body.state) await persistClicker(body.state);
    await logPurchase(body.key, "upgrade", Number(body.cost ?? 0));
    return NextResponse.json({ ok: true, state: body.state });
  }

  if (body.action === "premium" && body.key) {
    if (body.state) await persistClicker(body.state);
    await logPurchase(body.key, "iap_demo", 0);
    return NextResponse.json({ ok: true, state: body.state });
  }

  if (body.action === "event" && body.event) {
    await logEvent(body.event.kind, body.event.title, body.event.detail);
    if (body.state) await persistClicker(body.state);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
