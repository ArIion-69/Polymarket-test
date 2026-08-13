export type PolymarketMarket = {
  id: string;
  question: string;
  slug?: string;
  description?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string | number;
  volumeNum?: number;
  volume24hr?: number;
  liquidity?: string | number;
  liquidityNum?: number;
  spread?: number;
  oneDayPriceChange?: number;
  oneWeekPriceChange?: number;
  endDate?: string;
  closed?: boolean;
  active?: boolean;
  acceptingOrders?: boolean;
  umaResolutionStatus?: string;
  closedTime?: string;
  groupItemTitle?: string;
  events?: Array<{ title?: string; slug?: string }>;
};

function parseJsonArray(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parsePrices(value?: string): number[] {
  return parseJsonArray(value).map((x) => Number(x)).filter((n) => !Number.isNaN(n));
}

export function isBinaryYesNo(market: PolymarketMarket): boolean {
  const outcomes = parseJsonArray(market.outcomes).map((o) => o.toLowerCase());
  return outcomes.length === 2 && outcomes.includes("yes") && outcomes.includes("no");
}

export function getYesNoPrices(market: PolymarketMarket): { yes: number; no: number } | null {
  const outcomes = parseJsonArray(market.outcomes).map((o) => o.toLowerCase());
  const prices = parsePrices(market.outcomePrices);
  if (outcomes.length !== 2 || prices.length !== 2) return null;
  const yesIdx = outcomes.indexOf("yes");
  const noIdx = outcomes.indexOf("no");
  if (yesIdx < 0 || noIdx < 0) return null;
  return { yes: prices[yesIdx], no: prices[noIdx] };
}

export function inferResolution(market: PolymarketMarket): "yes" | "no" | null {
  if (!market.closed) return null;
  const prices = getYesNoPrices(market);
  if (!prices) return null;
  if (prices.yes >= 0.95 && prices.no <= 0.05) return "yes";
  if (prices.no >= 0.95 && prices.yes <= 0.05) return "no";
  if (market.umaResolutionStatus === "resolved") {
    return prices.yes >= prices.no ? "yes" : "no";
  }
  return null;
}

export async function fetchOpenMarkets(limit = 20): Promise<PolymarketMarket[]> {
  const url = new URL("https://gamma-api.polymarket.com/markets");
  url.searchParams.set("closed", "false");
  url.searchParams.set("active", "true");
  url.searchParams.set("limit", String(Math.max(limit * 3, 60)));
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Polymarket open markets HTTP ${res.status}`);
  const data = (await res.json()) as PolymarketMarket[];

  return data
    .filter((m) => m.acceptingOrders !== false)
    .filter(isBinaryYesNo)
    .filter((m) => {
      const prices = getYesNoPrices(m);
      const vol = Number(m.volume24hr ?? m.volumeNum ?? m.volume ?? 0);
      return prices && vol > 0;
    })
    .slice(0, limit);
}

export async function fetchRecentlyClosed(limit = 5): Promise<PolymarketMarket[]> {
  const url = new URL("https://gamma-api.polymarket.com/markets");
  url.searchParams.set("closed", "true");
  url.searchParams.set("limit", String(Math.max(limit * 4, 20)));
  url.searchParams.set("order", "closedTime");
  url.searchParams.set("ascending", "false");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Polymarket closed markets HTTP ${res.status}`);
  const data = (await res.json()) as PolymarketMarket[];

  return data
    .filter(isBinaryYesNo)
    .filter((m) => inferResolution(m) !== null)
    .slice(0, limit);
}

export function marketCategory(market: PolymarketMarket): string {
  const q = (market.question || "").toLowerCase();
  if (/\b(bitcoin|btc|ethereum|eth|crypto|solana|token)\b/.test(q)) return "Крипто";
  if (
    /\b(trump|election|president|senate|congress|prime minister|macron|starmer|politics|governor|nominee)\b/.test(
      q
    )
  )
    return "Политика";
  if (/\b(nba|nfl|mlb|soccer|football|ufc|match|championship|world cup|uefa)\b/.test(q))
    return "Спорт";
  if (/\b(fed|rate|gdp|inflation|ipo|stock|nasdaq|interest)\b/.test(q)) return "Экономика";
  if (/\b(openai|google|apple|microsoft|tech|ai)\b/.test(q)) return "Технологии";
  if (/\b(iran|hormuz|blockade|strait)\b/.test(q)) return "Геополитика";
  return "Другое";
}
