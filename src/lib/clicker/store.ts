import { prisma } from "@/lib/db";
import {
  applyIdle,
  EMPTY_PREMIUM,
  EMPTY_UPGRADES,
  type ClickerState,
  type Premium,
  type Upgrades,
} from "@/lib/clicker/economy";

const SAVE_ID = "local";

function parseState(row: {
  cope: number;
  totalCope: number;
  clicks: number;
  stage: number;
  upgradesJson: string;
  premiumJson: string;
  lastTick: Date;
}): ClickerState {
  let upgrades: Upgrades = { ...EMPTY_UPGRADES };
  let premium: Premium = { ...EMPTY_PREMIUM };
  try {
    upgrades = { ...EMPTY_UPGRADES, ...JSON.parse(row.upgradesJson) };
  } catch {
    /* keep defaults */
  }
  try {
    premium = { ...EMPTY_PREMIUM, ...JSON.parse(row.premiumJson) };
  } catch {
    /* keep defaults */
  }
  return {
    cope: row.cope,
    totalCope: row.totalCope,
    clicks: row.clicks,
    stage: row.stage,
    upgrades,
    premium,
    lastTick: row.lastTick.toISOString(),
  };
}

export async function loadClicker(): Promise<{
  state: ClickerState;
  events: Array<{ id: string; kind: string; title: string; detail: string; createdAt: string }>;
  purchases: Array<{ id: string; sku: string; kind: string; cost: number; createdAt: string }>;
}> {
  let row = await prisma.clickerSave.findUnique({ where: { id: SAVE_ID } });
  if (!row) {
    row = await prisma.clickerSave.create({ data: { id: SAVE_ID } });
  }
  const idle = applyIdle(parseState(row));
  if (idle.gained > 0.01 || idle.state.stage !== row.stage) {
    row = await prisma.clickerSave.update({
      where: { id: SAVE_ID },
      data: {
        cope: idle.state.cope,
        totalCope: idle.state.totalCope,
        stage: idle.state.stage,
        lastTick: new Date(idle.state.lastTick),
      },
    });
  }

  const [events, purchases] = await Promise.all([
    prisma.clickerEventLog.findMany({
      where: { saveId: SAVE_ID },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.clickerPurchase.findMany({
      where: { saveId: SAVE_ID },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return {
    state: parseState(row),
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
    purchases: purchases.map((p) => ({
      id: p.id,
      sku: p.sku,
      kind: p.kind,
      cost: p.cost,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export async function persistClicker(state: ClickerState) {
  await prisma.clickerSave.upsert({
    where: { id: SAVE_ID },
    create: {
      id: SAVE_ID,
      cope: state.cope,
      totalCope: state.totalCope,
      clicks: state.clicks,
      stage: state.stage,
      upgradesJson: JSON.stringify(state.upgrades),
      premiumJson: JSON.stringify(state.premium),
      lastTick: new Date(state.lastTick),
    },
    update: {
      cope: state.cope,
      totalCope: state.totalCope,
      clicks: state.clicks,
      stage: state.stage,
      upgradesJson: JSON.stringify(state.upgrades),
      premiumJson: JSON.stringify(state.premium),
      lastTick: new Date(state.lastTick),
    },
  });
}

export async function logPurchase(sku: string, kind: string, cost: number) {
  await prisma.clickerPurchase.create({
    data: { saveId: SAVE_ID, sku, kind, cost },
  });
}

export async function logEvent(kind: string, title: string, detail: string) {
  await prisma.clickerEventLog.create({
    data: { saveId: SAVE_ID, kind, title, detail },
  });
}
