import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.source.upsert({
    where: { key: "polymarket" },
    update: {
      name: "Polymarket Gamma API",
      kind: "market",
      baseUrl: "https://gamma-api.polymarket.com",
      description: "Котировки бинарных рынков YES/NO, объёмы, ликвидность, импульс цены",
    },
    create: {
      key: "polymarket",
      name: "Polymarket Gamma API",
      kind: "market",
      baseUrl: "https://gamma-api.polymarket.com",
      description: "Котировки бинарных рынков YES/NO, объёмы, ликвидность, импульс цены",
    },
  });

  await prisma.source.upsert({
    where: { key: "google_news" },
    update: {
      name: "Google News RSS",
      kind: "news",
      baseUrl: "https://news.google.com/rss/search",
      description: "Заголовки новостей по запросу из вопроса рынка (без API-ключа)",
    },
    create: {
      key: "google_news",
      name: "Google News RSS",
      kind: "news",
      baseUrl: "https://news.google.com/rss/search",
      description: "Заголовки новостей по запросу из вопроса рынка (без API-ключа)",
    },
  });

  console.log("Sources seeded: polymarket, google_news");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
