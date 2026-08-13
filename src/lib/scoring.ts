/** Fixed algorithm weights — must match README and UI methodology. */
export const WEIGHTS = {
  market: 0.5,
  news: 0.3,
  momentum: 0.2,
} as const;

export const NEWS_SCALE = 2;
export const MOMENTUM_SCALE = 1.5;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "will",
  "be",
  "by",
  "in",
  "on",
  "of",
  "to",
  "for",
  "at",
  "or",
  "and",
  "is",
  "are",
  "was",
  "were",
  "this",
  "that",
  "with",
  "from",
  "as",
  "if",
  "before",
  "after",
  "between",
  "than",
  "vs",
  "versus",
  "next",
  "year",
  "years",
  "month",
  "months",
  "day",
  "days",
  "week",
  "weeks",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
  "2024",
  "2025",
  "2026",
  "2027",
  "2028",
  "q1",
  "q2",
  "q3",
  "q4",
  "end",
  "out",
  "into",
  "over",
  "under",
  "more",
  "less",
  "than",
  "what",
  "when",
  "who",
  "which",
  "how",
  "does",
  "do",
  "did",
  "have",
  "has",
  "had",
  "any",
  "all",
  "its",
  "it",
  "his",
  "her",
  "their",
  "yes",
  "no",
]);

const YES_LEXICON = [
  "approved",
  "approves",
  "approval",
  "wins",
  "won",
  "victory",
  "passes",
  "passed",
  "confirms",
  "confirmed",
  "launches",
  "launched",
  "succeeds",
  "successful",
  "clears",
  "cleared",
  "greenlights",
  "greenlight",
  "ratifies",
  "ratified",
  "signs",
  "signed",
  "completes",
  "completed",
  "achieves",
  "achieved",
  "surges",
  "rallies",
  "breakthrough",
  "deal",
  "agreement",
  "endorses",
  "endorsed",
  "elected",
  "elects",
  "secures",
  "secured",
];

const NO_LEXICON = [
  "rejected",
  "rejects",
  "rejection",
  "delay",
  "delayed",
  "delays",
  "fails",
  "failed",
  "failure",
  "blocks",
  "blocked",
  "cancels",
  "cancelled",
  "canceled",
  "denies",
  "denied",
  "denial",
  "lawsuit",
  "probe",
  "investigation",
  "scandal",
  "crash",
  "plunges",
  "collapse",
  "loses",
  "lost",
  "defeat",
  "opposition",
  "setback",
  "halt",
  "halted",
  "suspends",
  "suspended",
  "ban",
  "banned",
  "crackdown",
  "resigns",
  "resignation",
  "indicted",
  "indictment",
];

const NEGATION = ["not", "no", "never", "without", "isn't", "aren't", "won't", "didn't", "doesn't", "cannot", "can't"];

export function clip(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

export function extractQueryTokens(question: string, limit = 6): string[] {
  const tokens = tokenize(question);
  const unique: string[] = [];
  for (const t of tokens) {
    if (!unique.includes(t)) unique.push(t);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function buildNewsQuery(question: string): string {
  const tokens = extractQueryTokens(question, 5);
  return tokens.length > 0 ? tokens.join(" ") : question.slice(0, 80);
}

export function scoreHeadlinePolarity(
  title: string,
  question: string
): { polarity: number; matchedTokens: string[]; relevance: number } {
  const titleTokens = tokenize(title);
  const questionTokens = new Set(extractQueryTokens(question, 12));
  const matchedTokens = titleTokens.filter((t) => questionTokens.has(t));
  const relevance =
    questionTokens.size === 0
      ? 0
      : clip(matchedTokens.length / Math.min(4, questionTokens.size), 0, 1);

  let score = 0;
  for (let i = 0; i < titleTokens.length; i++) {
    const token = titleTokens[i];
    const prev = titleTokens[i - 1];
    const negated = prev ? NEGATION.includes(prev) : false;
    if (YES_LEXICON.includes(token)) score += negated ? -1 : 1;
    if (NO_LEXICON.includes(token)) score += negated ? 1 : -1;
  }

  const polarity = clip(score / 3, -1, 1);
  return { polarity, matchedTokens, relevance };
}

export function recencyWeight(publishedAt: Date | null, now = new Date()): number {
  if (!publishedAt) return 0.35;
  const ageHours = Math.max(0, (now.getTime() - publishedAt.getTime()) / 3_600_000);
  return Math.exp(-ageHours / 48);
}

export function logit(p: number): number {
  const clipped = clip(p, 0.02, 0.98);
  return Math.log(clipped / (1 - clipped));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export type NewsForScore = {
  polarity: number;
  recencyWeight: number;
  relevance: number;
  title: string;
  publisher?: string | null;
};

export type MarketForScore = {
  yesPrice: number;
  oneDayPriceChange: number;
  liquidity: number;
  spread: number;
  deadline?: Date | null;
};

export type ScoreResult = {
  pYes: number;
  pMarket: number;
  delta: number;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  riskReasons: string[];
  arguments: string[];
  formula: Record<string, number | string>;
  factors: Array<{
    key: string;
    label: string;
    weight: number;
    rawValue: number;
    contribution: number;
    explanation: string;
  }>;
  indicators: {
    marketYes: number;
    momentum: number;
    newsPolarity: number;
    newsCoverage: number;
    newsRecency: number;
    liquidityScore: number;
  };
  revisionTriggers: string[];
};

export function computeForecast(
  market: MarketForScore,
  news: NewsForScore[],
  now = new Date()
): ScoreResult {
  const pMarket = clip(market.yesPrice, 0.02, 0.98);
  const logitM = logit(pMarket);

  const relevant = news.filter((n) => n.relevance >= 0.15 || Math.abs(n.polarity) > 0);
  const coverage = clip(relevant.length / 5, 0, 1);
  const avgRecency =
    relevant.length === 0
      ? 0
      : relevant.reduce((s, n) => s + n.recencyWeight, 0) / relevant.length;
  const weightedPolarity =
    relevant.length === 0
      ? 0
      : relevant.reduce((s, n) => s + n.polarity * (0.4 + 0.6 * n.relevance) * n.recencyWeight, 0) /
        Math.max(
          relevant.reduce((s, n) => s + (0.4 + 0.6 * n.relevance) * n.recencyWeight, 0),
          0.01
        );

  const newsEvidence =
    weightedPolarity * (0.5 + 0.5 * avgRecency) * (0.3 + 0.7 * coverage);
  const momentum = clip(market.oneDayPriceChange / 0.1, -1, 1);
  const liquidityScore = clip(Math.log10(Math.max(market.liquidity, 1) + 1) / 5, 0, 1);

  const marketContribution = WEIGHTS.market * logitM;
  const newsContribution = WEIGHTS.news * (newsEvidence * NEWS_SCALE);
  const momentumContribution = WEIGHTS.momentum * (momentum * MOMENTUM_SCALE);
  const totalLogit = marketContribution + newsContribution + momentumContribution;
  const pYes = sigmoid(totalLogit);

  const agreement =
    Math.abs(weightedPolarity) < 0.05
      ? 0.5
      : Math.sign(weightedPolarity) === Math.sign(pMarket - 0.5) ||
          (pMarket >= 0.45 && pMarket <= 0.55)
        ? 1
        : 0;

  const confidence = clip(
    100 * (0.4 * coverage + 0.35 * agreement + 0.25 * liquidityScore),
    5,
    95
  );

  const riskReasons: string[] = [];
  if (relevant.length < 2) riskReasons.push("Мало релевантных новостей — сигнал новостей слабый");
  if (agreement === 0) riskReasons.push("Новости противоречат рыночной цене YES");
  if (liquidityScore < 0.35) riskReasons.push("Низкая ликвидность рынка — котировка может быть шумной");
  if (market.spread > 0.08) riskReasons.push(`Широкий спред (${(market.spread * 100).toFixed(1)} п.п.)`);
  if (market.deadline) {
    const hoursLeft = (market.deadline.getTime() - now.getTime()) / 3_600_000;
    if (hoursLeft >= 0 && hoursLeft < 48) {
      riskReasons.push("До дедлайна меньше 48 часов — исход может быстро измениться");
    }
  }

  const riskLevel: ScoreResult["riskLevel"] =
    riskReasons.length >= 3 ? "high" : riskReasons.length >= 1 ? "medium" : "low";

  const argumentsList: string[] = [
    `Рынок Polymarket котирует YES ≈ ${(pMarket * 100).toFixed(1)}% (logit=${logitM.toFixed(3)}, вклад=${marketContribution.toFixed(3)})`,
    relevant.length > 0
      ? `Новости: polarity=${weightedPolarity.toFixed(2)}, coverage=${coverage.toFixed(2)}, evidence=${newsEvidence.toFixed(3)} → вклад=${newsContribution.toFixed(3)}`
      : "Релевантных новостей почти нет — вклад новостей близок к нулю",
    `Импульс цены YES за сутки: ${(market.oneDayPriceChange * 100).toFixed(1)} п.п. → momentum=${momentum.toFixed(2)}, вклад=${momentumContribution.toFixed(3)}`,
    `Итоговый logit=${totalLogit.toFixed(3)} → σ(logit)=${(pYes * 100).toFixed(1)}%`,
  ];

  if (relevant[0]) {
    argumentsList.push(
      `Ключевой заголовок: «${relevant[0].title}» (polarity ${relevant[0].polarity.toFixed(2)})`
    );
  }

  const revisionTriggers: string[] = [];
  if (Math.abs(pYes - pMarket) > 0.15) {
    revisionTriggers.push(
      `Рынок и модель расходятся больше чем на 15 п.п. (Δ=${((pYes - pMarket) * 100).toFixed(1)})`
    );
  }
  const opposing = relevant.filter((n) => Math.sign(n.polarity) === -Math.sign(pYes - 0.5) && Math.abs(n.polarity) >= 0.3);
  if (opposing.length >= 3) {
    revisionTriggers.push(`Накопилось ${opposing.length} противоположных заголовков — нужен пересмотр`);
  }

  return {
    pYes,
    pMarket,
    delta: pYes - pMarket,
    confidence,
    riskLevel,
    riskReasons,
    arguments: argumentsList,
    formula: {
      p_m: pMarket,
      logit_m: logitM,
      news_evidence: newsEvidence,
      momentum,
      weighted_polarity: weightedPolarity,
      coverage,
      avg_recency: avgRecency,
      market_contribution: marketContribution,
      news_contribution: newsContribution,
      momentum_contribution: momentumContribution,
      logit: totalLogit,
      p_yes: pYes,
      weight_market: WEIGHTS.market,
      weight_news: WEIGHTS.news,
      weight_momentum: WEIGHTS.momentum,
      news_scale: NEWS_SCALE,
      momentum_scale: MOMENTUM_SCALE,
    },
    factors: [
      {
        key: "market",
        label: "Рыночная вероятность YES",
        weight: WEIGHTS.market,
        rawValue: pMarket,
        contribution: marketContribution,
        explanation: `logit(${(pMarket * 100).toFixed(1)}%) = ${logitM.toFixed(3)}; × ${WEIGHTS.market}`,
      },
      {
        key: "news",
        label: "Новостной evidence",
        weight: WEIGHTS.news,
        rawValue: newsEvidence,
        contribution: newsContribution,
        explanation: `evidence=${newsEvidence.toFixed(3)} × ${NEWS_SCALE} × ${WEIGHTS.news}`,
      },
      {
        key: "momentum",
        label: "Импульс цены YES (1d)",
        weight: WEIGHTS.momentum,
        rawValue: momentum,
        contribution: momentumContribution,
        explanation: `momentum=${momentum.toFixed(3)} × ${MOMENTUM_SCALE} × ${WEIGHTS.momentum}`,
      },
    ],
    indicators: {
      marketYes: pMarket,
      momentum,
      newsPolarity: weightedPolarity,
      newsCoverage: coverage,
      newsRecency: avgRecency,
      liquidityScore,
    },
    revisionTriggers,
  };
}

export function evaluateForecast(
  pYes: number,
  outcomeYes: 0 | 1,
  factors: ScoreResult["factors"]
): { brierScore: number; wasWrong: boolean; attribution: string } {
  const brierScore = (pYes - outcomeYes) ** 2;
  const predictedSide = pYes >= 0.5 ? 1 : 0;
  const wasWrong = predictedSide !== outcomeYes || brierScore > 0.25;

  const sorted = [...factors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const top = sorted[0];
  let attribution: string;
  if (!wasWrong) {
    attribution = `Прогноз совпал со стороной исхода. Brier=${brierScore.toFixed(3)}.`;
  } else if (top) {
    const direction = top.contribution >= 0 ? "в сторону YES" : "в сторону NO";
    attribution = `Промах: Brier=${brierScore.toFixed(3)}. Главный фактор, тянувший ${direction}: ${top.label} (вклад ${top.contribution.toFixed(3)}).`;
  } else {
    attribution = `Промах: Brier=${brierScore.toFixed(3)}.`;
  }

  return { brierScore, wasWrong, attribution };
}
