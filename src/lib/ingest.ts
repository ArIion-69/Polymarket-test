import { prisma } from "@/lib/db";
import { maybeRewriteArguments } from "@/lib/ai";
import { fetchNewsForQuestion } from "@/lib/news";
import {
  fetchOpenMarkets,
  fetchRecentlyClosed,
  getYesNoPrices,
  inferResolution,
  marketCategory,
  type PolymarketMarket,
} from "@/lib/polymarket";
import { computeForecast, evaluateForecast } from "@/lib/scoring";

export type IngestResult = {
  marketsCount: number;
  newsCount: number;
  message: string;
};

let ingestLock: Promise<IngestResult> | null = null;

async function ensureSources() {
  const poly = await prisma.source.upsert({
    where: { key: "polymarket" },
    update: {},
    create: {
      key: "polymarket",
      name: "Polymarket Gamma API",
      kind: "market",
      baseUrl: "https://gamma-api.polymarket.com",
      description: "Котировки бинарных рынков YES/NO",
    },
  });
  const news = await prisma.source.upsert({
    where: { key: "google_news" },
    update: {},
    create: {
      key: "google_news",
      name: "Google News RSS",
      kind: "news",
      baseUrl: "https://news.google.com/rss/search",
      description: "Заголовки новостей по запросу",
    },
  });
  return { poly, news };
}

async function upsertEvent(market: PolymarketMarket, closed: boolean) {
  const prices = getYesNoPrices(market);
  if (!prices) return null;

  const resolution = closed ? inferResolution(market) : null;
  const status = closed ? "closed" : "open";

  return prisma.event.upsert({
    where: { externalId: market.id },
    update: {
      question: market.question,
      slug: market.slug ?? null,
      description: market.description ?? null,
      category: marketCategory(market),
      deadline: market.endDate ? new Date(market.endDate) : null,
      status,
      resolution,
      resolvedAt: resolution ? (market.closedTime ? new Date(market.closedTime) : new Date()) : null,
    },
    create: {
      externalId: market.id,
      question: market.question,
      slug: market.slug ?? null,
      description: market.description ?? null,
      category: marketCategory(market),
      deadline: market.endDate ? new Date(market.endDate) : null,
      status,
      resolution,
      resolvedAt: resolution ? (market.closedTime ? new Date(market.closedTime) : new Date()) : null,
    },
  });
}

async function processMarket(
  market: PolymarketMarket,
  closed: boolean,
  polySourceId: string,
  newsSourceId: string,
  polyRunId: string,
  newsRunId: string
) {
  const prices = getYesNoPrices(market);
  if (!prices) return { newsCount: 0 };

  await prisma.rawRecord.create({
    data: {
      sourceId: polySourceId,
      ingestRunId: polyRunId,
      externalKey: market.id,
      payload: JSON.stringify(market),
    },
  });

  const event = await upsertEvent(market, closed);
  if (!event) return { newsCount: 0 };

  const snapshot = await prisma.marketSnapshot.create({
    data: {
      eventId: event.id,
      yesPrice: prices.yes,
      noPrice: prices.no,
      volume: Number(market.volumeNum ?? market.volume ?? 0),
      volume24h: Number(market.volume24hr ?? 0),
      liquidity: Number(market.liquidityNum ?? market.liquidity ?? 0),
      spread: Number(market.spread ?? Math.abs(prices.yes + prices.no - 1)),
      oneDayPriceChange: Number(market.oneDayPriceChange ?? 0),
      oneWeekPriceChange: Number(market.oneWeekPriceChange ?? 0),
    },
  });

  let newsCount = 0;
  const newsRows = [];
  try {
    const news = await fetchNewsForQuestion(market.question, 8);
    for (const item of news) {
      await prisma.rawRecord.create({
        data: {
          sourceId: newsSourceId,
          ingestRunId: newsRunId,
          externalKey: `${market.id}:${item.url}`.slice(0, 500),
          payload: item.rawXmlSnippet,
        },
      });

      const row = await prisma.newsItem.upsert({
        where: { eventId_url: { eventId: event.id, url: item.url } },
        update: {
          title: item.title,
          publisher: item.publisher,
          publishedAt: item.publishedAt,
          polarity: item.polarity,
          matchedTokens: JSON.stringify(item.matchedTokens),
          recencyWeight: item.recencyWeight,
          relevance: item.relevance,
          capturedAt: new Date(),
        },
        create: {
          eventId: event.id,
          title: item.title,
          url: item.url,
          publisher: item.publisher,
          publishedAt: item.publishedAt,
          polarity: item.polarity,
          matchedTokens: JSON.stringify(item.matchedTokens),
          recencyWeight: item.recencyWeight,
          relevance: item.relevance,
        },
      });
      newsRows.push(row);
      newsCount += 1;
    }
  } catch (err) {
    console.warn(`News fetch failed for ${market.id}:`, err);
  }

  const score = computeForecast(
    {
      yesPrice: snapshot.yesPrice,
      oneDayPriceChange: snapshot.oneDayPriceChange,
      liquidity: snapshot.liquidity,
      spread: snapshot.spread,
      deadline: event.deadline,
    },
    newsRows.map((n) => ({
      polarity: n.polarity,
      recencyWeight: n.recencyWeight,
      relevance: n.relevance,
      title: n.title,
      publisher: n.publisher,
    }))
  );

  await prisma.indicator.create({
    data: {
      eventId: event.id,
      marketYes: score.indicators.marketYes,
      momentum: score.indicators.momentum,
      newsPolarity: score.indicators.newsPolarity,
      newsCoverage: score.indicators.newsCoverage,
      newsRecency: score.indicators.newsRecency,
      liquidityScore: score.indicators.liquidityScore,
    },
  });

  let args = score.arguments;
  const rewritten = await maybeRewriteArguments(
    event.question,
    score.arguments,
    score.pYes,
    score.confidence
  );
  if (rewritten) args = rewritten;

  const forecast = await prisma.forecast.create({
    data: {
      eventId: event.id,
      pYes: score.pYes,
      pMarket: score.pMarket,
      delta: score.delta,
      confidence: score.confidence,
      riskLevel: score.riskLevel,
      riskReasons: JSON.stringify(score.riskReasons),
      argumentsJson: JSON.stringify(args),
      formulaJson: JSON.stringify(score.formula),
      factors: {
        create: score.factors.map((f) => ({
          key: f.key,
          label: f.label,
          weight: f.weight,
          rawValue: f.rawValue,
          contribution: f.contribution,
          explanation: f.explanation,
        })),
      },
    },
  });

  if (event.resolution === "yes" || event.resolution === "no") {
    const outcomeYes = event.resolution === "yes" ? 1 : 0;
    const evaluation = evaluateForecast(forecast.pYes, outcomeYes as 0 | 1, score.factors);
    await prisma.evaluation.create({
      data: {
        eventId: event.id,
        forecastId: forecast.id,
        outcomeYes,
        brierScore: evaluation.brierScore,
        wasWrong: evaluation.wasWrong,
        attribution: evaluation.attribution,
        revisionTriggers: JSON.stringify(score.revisionTriggers),
      },
    });
  } else if (score.revisionTriggers.length > 0) {
    await prisma.evaluation.create({
      data: {
        eventId: event.id,
        forecastId: forecast.id,
        outcomeYes: -1,
        brierScore: 0,
        wasWrong: false,
        attribution: "Рынок ещё открыт. Условия пересмотра зафиксированы.",
        revisionTriggers: JSON.stringify(score.revisionTriggers),
      },
    });
  }

  console.log(
    `✓ ${event.status.toUpperCase()} ${(score.pYes * 100).toFixed(1)}% | ${event.question.slice(0, 70)}`
  );

  return { newsCount };
}

async function runIngestUnlocked(): Promise<IngestResult> {
  const { poly, news } = await ensureSources();

  const polyRun = await prisma.ingestRun.create({
    data: { sourceId: poly.id, status: "running" },
  });
  const newsRun = await prisma.ingestRun.create({
    data: { sourceId: news.id, status: "running" },
  });

  let marketsCount = 0;
  let newsCount = 0;

  try {
    const open = await fetchOpenMarkets(12);
    const closed = await fetchRecentlyClosed(3);
    const all: Array<{ market: PolymarketMarket; closed: boolean }> = [
      ...open.map((m) => ({ market: m, closed: false })),
      ...closed.map((m) => ({ market: m, closed: true })),
    ];

    for (const item of all) {
      const result = await processMarket(
        item.market,
        item.closed,
        poly.id,
        news.id,
        polyRun.id,
        newsRun.id
      );
      marketsCount += 1;
      newsCount += result.newsCount;
      await new Promise((r) => setTimeout(r, 200));
    }

    await prisma.ingestRun.update({
      where: { id: polyRun.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        marketsCount,
        newsCount: 0,
        message: `Обработано рынков: ${marketsCount}`,
      },
    });
    await prisma.ingestRun.update({
      where: { id: newsRun.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        marketsCount,
        newsCount,
        message: `Новостей сохранено: ${newsCount}`,
      },
    });

    return {
      marketsCount,
      newsCount,
      message: `Обновлено: рынков ${marketsCount}, новостей ${newsCount}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.ingestRun.update({
      where: { id: polyRun.id },
      data: { status: "error", finishedAt: new Date(), message },
    });
    await prisma.ingestRun.update({
      where: { id: newsRun.id },
      data: { status: "error", finishedAt: new Date(), message },
    });
    throw err;
  }
}

export function runIngest(): Promise<IngestResult> {
  if (ingestLock) return ingestLock;
  ingestLock = runIngestUnlocked().finally(() => {
    ingestLock = null;
  });
  return ingestLock;
}
