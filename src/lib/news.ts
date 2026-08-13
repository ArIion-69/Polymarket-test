import { XMLParser } from "fast-xml-parser";
import { buildNewsQuery, recencyWeight, scoreHeadlinePolarity } from "./scoring";

export type FetchedNews = {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: Date | null;
  polarity: number;
  matchedTokens: string[];
  recencyWeight: number;
  relevance: number;
  rawXmlSnippet: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function fetchNewsForQuestion(question: string, limit = 8): Promise<FetchedNews[]> {
  const q = buildNewsQuery(question);
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${q} when:7d`);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": "polymarket-predictor/0.1 (educational prototype)",
    },
  });
  if (!res.ok) throw new Error(`Google News RSS HTTP ${res.status} for q=${q}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items = asArray(parsed?.rss?.channel?.item);

  const now = new Date();
  const results: FetchedNews[] = [];

  for (const item of items.slice(0, limit)) {
    const title = String(item.title ?? "").trim();
    const link = String(item.link ?? "").trim();
    if (!title || !link) continue;

    const publisher =
      (item.source?.["#text"] as string | undefined) ||
      (typeof item.source === "string" ? item.source : null) ||
      null;
    const publishedAt = parseDate(item.pubDate);
    const scored = scoreHeadlinePolarity(title, question);
    const rw = recencyWeight(publishedAt, now);

    results.push({
      title,
      url: link,
      publisher,
      publishedAt,
      polarity: scored.polarity,
      matchedTokens: scored.matchedTokens,
      recencyWeight: rw,
      relevance: scored.relevance,
      rawXmlSnippet: JSON.stringify({
        title,
        link,
        pubDate: item.pubDate ?? null,
        source: publisher,
      }),
    });
  }

  return results;
}
