export type UpgradeKey =
  | "espresso"
  | "autopilot"
  | "critHat"
  | "comboStream"
  | "insurance"
  | "nftFire";

export type PremiumKey = "noAds" | "battlePass" | "starterPack";

export type Upgrades = Record<UpgradeKey, number>;
export type Premium = Record<PremiumKey, boolean>;

export type ClickerState = {
  cope: number;
  totalCope: number;
  clicks: number;
  stage: number;
  upgrades: Upgrades;
  premium: Premium;
  lastTick: string;
};

export const EMPTY_UPGRADES: Upgrades = {
  espresso: 0,
  autopilot: 0,
  critHat: 0,
  comboStream: 0,
  insurance: 0,
  nftFire: 0,
};

export const EMPTY_PREMIUM: Premium = {
  noAds: false,
  battlePass: false,
  starterPack: false,
};

export const STAGES = [
  {
    id: 0,
    name: "Искра на коврике",
    blurb: "Всё нормально. Просто немного дыма.",
    unlockAt: 0,
    fire: 1,
  },
  {
    id: 1,
    name: "Кухня в огне",
    blurb: "Тост подгорел. Кофе ещё горячее.",
    unlockAt: 80,
    fire: 2,
  },
  {
    id: 2,
    name: "Горит весь дом",
    blurb: "Стрим из гостиной набирает просмотры.",
    unlockAt: 600,
    fire: 3,
  },
  {
    id: 3,
    name: "Район в трендах",
    blurb: "Соседи тоже пьют кофе. Хайп растёт.",
    unlockAt: 4000,
    fire: 4,
  },
  {
    id: 4,
    name: "Глобальный мем",
    blurb: "Планета в огне. Вы улыбаетесь.",
    unlockAt: 25000,
    fire: 5,
  },
] as const;

export type UpgradeDef = {
  key: UpgradeKey;
  name: string;
  description: string;
  mechanic: string;
  baseCost: number;
  growth: number;
  max: number;
  unlockStage: number;
  kind: "stat" | "mechanic";
};

export const UPGRADES: UpgradeDef[] = [
  {
    key: "espresso",
    name: "Крепкий эспрессо",
    description: "+1 cope за глоток",
    mechanic: "Больше cope за клик",
    baseCost: 12,
    growth: 1.32,
    max: 40,
    unlockStage: 0,
    kind: "stat",
  },
  {
    key: "autopilot",
    name: "Автопилот «всё нормально»",
    description: "Пёс сам делает глотки, даже если вы отошли",
    mechanic: "Idle: +0.6 cope/сек за уровень. Меняет игру с чистого кликера на тайкун.",
    baseCost: 45,
    growth: 1.42,
    max: 25,
    unlockStage: 0,
    kind: "mechanic",
  },
  {
    key: "critHat",
    name: "Шляпа «This is Fine»",
    description: "Шанс критического глотка ×5",
    mechanic: "+8% крит за уровень (макс. 40%). Не множитель, а новая броска-механика.",
    baseCost: 90,
    growth: 1.48,
    max: 5,
    unlockStage: 1,
    kind: "mechanic",
  },
  {
    key: "comboStream",
    name: "Стрим из горящей кухни",
    description: "Серия быстрых кликов даёт комбо",
    mechanic: "Клики чаще 0.7с копят комбо. Кап комбо = уровень. Новая ритм-механика.",
    baseCost: 160,
    growth: 1.55,
    max: 8,
    unlockStage: 1,
    kind: "mechanic",
  },
  {
    key: "insurance",
    name: "Страховка Fine Inc.",
    description: "Кризисы забирают меньше cope",
    mechanic: "Каждый уровень −12% потерь от кризиса (минимум 8%)",
    baseCost: 140,
    growth: 1.5,
    max: 6,
    unlockStage: 2,
    kind: "stat",
  },
  {
    key: "nftFire",
    name: "NFT картины пожара",
    description: "×1.22 ко всему доходу за уровень",
    mechanic: "Глобальный множитель",
    baseCost: 280,
    growth: 1.65,
    max: 12,
    unlockStage: 2,
    kind: "stat",
  },
];

export const PREMIUM_OFFERS: Array<{
  key: PremiumKey;
  name: string;
  priceLabel: string;
  pitch: string;
  effect: string;
}> = [
  {
    key: "noAds",
    name: "Убрать рекламу",
    priceLabel: "₽149 · демо",
    pitch: "Без баннера «Fine Insurance» после событий",
    effect: "Отключает фейковую рекламу между ивентами",
  },
  {
    key: "battlePass",
    name: "Боевой пропуск: Сезон дыма",
    priceLabel: "₽349 · демо",
    pitch: "Значок сезона и +15% ко всему cope",
    effect: "Постоянный бонус дохода + сезонный бейдж",
  },
  {
    key: "starterPack",
    name: "Стартовый набор",
    priceLabel: "₽99 · демо",
    pitch: "+250 cope и 1 эспрессо сразу",
    effect: "Разовый буст прогресса (один раз)",
  },
];

export function defaultState(): ClickerState {
  return {
    cope: 0,
    totalCope: 0,
    clicks: 0,
    stage: 0,
    upgrades: { ...EMPTY_UPGRADES },
    premium: { ...EMPTY_PREMIUM },
    lastTick: new Date().toISOString(),
  };
}

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.floor(def.baseCost * def.growth ** level);
}

export function globalMult(state: ClickerState): number {
  const nft = 1.22 ** state.upgrades.nftFire;
  const pass = state.premium.battlePass ? 1.15 : 1;
  const stageBonus = 1 + state.stage * 0.08;
  return nft * pass * stageBonus;
}

export function clickPower(state: ClickerState): number {
  return (1 + state.upgrades.espresso) * globalMult(state);
}

export function critChance(state: ClickerState): number {
  return Math.min(0.4, state.upgrades.critHat * 0.08);
}

export function cps(state: ClickerState): number {
  if (state.upgrades.autopilot <= 0) return 0;
  return state.upgrades.autopilot * 0.6 * globalMult(state);
}

export function comboCap(state: ClickerState): number {
  return state.upgrades.comboStream;
}

export function crisisLossRate(state: ClickerState): number {
  return Math.max(0.08, 0.4 - state.upgrades.insurance * 0.12);
}

export function currentStage(totalCope: number): number {
  let stage = 0;
  for (const s of STAGES) {
    if (totalCope >= s.unlockAt) stage = s.id;
  }
  return stage;
}

export function applyIdle(state: ClickerState, now = Date.now()): { gained: number; state: ClickerState } {
  const last = new Date(state.lastTick).getTime();
  const dt = Math.min(60 * 60 * 8, Math.max(0, (now - last) / 1000));
  const gained = cps(state) * dt;
  const next = {
    ...state,
    cope: state.cope + gained,
    totalCope: state.totalCope + gained,
    lastTick: new Date(now).toISOString(),
  };
  next.stage = currentStage(next.totalCope);
  return { gained, state: next };
}

export function resolveClick(
  state: ClickerState,
  combo: number
): { gain: number; crit: boolean; combo: number; state: ClickerState } {
  const cap = comboCap(state);
  const nextCombo = cap > 0 ? Math.min(cap, combo + 1) : 0;
  const comboMult = cap > 0 ? 1 + nextCombo * 0.18 : 1;
  const crit = Math.random() < critChance(state);
  const gain = clickPower(state) * comboMult * (crit ? 5 : 1);
  const next: ClickerState = {
    ...state,
    cope: state.cope + gain,
    totalCope: state.totalCope + gain,
    clicks: state.clicks + 1,
    lastTick: new Date().toISOString(),
  };
  next.stage = currentStage(next.totalCope);
  return { gain, crit, combo: nextCombo, state: next };
}

export function tryBuyUpgrade(
  state: ClickerState,
  key: UpgradeKey
): { ok: boolean; cost: number; reason?: string; state: ClickerState } {
  const def = UPGRADES.find((u) => u.key === key);
  if (!def) return { ok: false, cost: 0, reason: "Нет такого улучшения", state };
  if (state.stage < def.unlockStage) {
    return { ok: false, cost: 0, reason: "Ещё не открыт этап", state };
  }
  const level = state.upgrades[key];
  if (level >= def.max) return { ok: false, cost: 0, reason: "Максимум", state };
  const cost = upgradeCost(def, level);
  if (state.cope < cost) return { ok: false, cost, reason: "Не хватает cope", state };
  const next: ClickerState = {
    ...state,
    cope: state.cope - cost,
    upgrades: { ...state.upgrades, [key]: level + 1 },
    lastTick: new Date().toISOString(),
  };
  return { ok: true, cost, state: next };
}

export function applyPremium(
  state: ClickerState,
  key: PremiumKey
): { ok: boolean; reason?: string; state: ClickerState } {
  if (state.premium[key]) return { ok: false, reason: "Уже куплено (демо)", state };
  const next: ClickerState = {
    ...state,
    premium: { ...state.premium, [key]: true },
    lastTick: new Date().toISOString(),
  };
  if (key === "starterPack") {
    next.cope += 250;
    next.totalCope += 250;
    next.upgrades = { ...next.upgrades, espresso: next.upgrades.espresso + 1 };
    next.stage = currentStage(next.totalCope);
  }
  return { ok: true, state: next };
}

export function formatCope(n: number): string {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}
