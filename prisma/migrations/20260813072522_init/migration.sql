-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "marketsCount" INTEGER NOT NULL DEFAULT 0,
    "newsCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    CONSTRAINT "IngestRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "ingestRunId" TEXT,
    "externalKey" TEXT,
    "payload" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RawRecord_ingestRunId_fkey" FOREIGN KEY ("ingestRunId") REFERENCES "IngestRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "slug" TEXT,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "yesPrice" REAL NOT NULL,
    "noPrice" REAL NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    "volume24h" REAL NOT NULL DEFAULT 0,
    "liquidity" REAL NOT NULL DEFAULT 0,
    "spread" REAL NOT NULL DEFAULT 0,
    "oneDayPriceChange" REAL NOT NULL DEFAULT 0,
    "oneWeekPriceChange" REAL NOT NULL DEFAULT 0,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketSnapshot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT,
    "publishedAt" DATETIME,
    "polarity" REAL NOT NULL DEFAULT 0,
    "matchedTokens" TEXT NOT NULL DEFAULT '[]',
    "recencyWeight" REAL NOT NULL DEFAULT 0,
    "relevance" REAL NOT NULL DEFAULT 0,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "marketYes" REAL NOT NULL,
    "momentum" REAL NOT NULL,
    "newsPolarity" REAL NOT NULL,
    "newsCoverage" REAL NOT NULL,
    "newsRecency" REAL NOT NULL,
    "liquidityScore" REAL NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Indicator_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "pYes" REAL NOT NULL,
    "pMarket" REAL NOT NULL,
    "delta" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskReasons" TEXT NOT NULL,
    "argumentsJson" TEXT NOT NULL,
    "formulaJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Forecast_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForecastFactor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forecastId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "rawValue" REAL NOT NULL,
    "contribution" REAL NOT NULL,
    "explanation" TEXT NOT NULL,
    CONSTRAINT "ForecastFactor_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "outcomeYes" REAL NOT NULL,
    "brierScore" REAL NOT NULL,
    "wasWrong" BOOLEAN NOT NULL,
    "attribution" TEXT NOT NULL,
    "revisionTriggers" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evaluation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evaluation_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "RawRecord_sourceId_fetchedAt_idx" ON "RawRecord"("sourceId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_externalId_key" ON "Event"("externalId");

-- CreateIndex
CREATE INDEX "MarketSnapshot_eventId_capturedAt_idx" ON "MarketSnapshot"("eventId", "capturedAt");

-- CreateIndex
CREATE INDEX "NewsItem_eventId_capturedAt_idx" ON "NewsItem"("eventId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_eventId_url_key" ON "NewsItem"("eventId", "url");

-- CreateIndex
CREATE INDEX "Indicator_eventId_computedAt_idx" ON "Indicator"("eventId", "computedAt");

-- CreateIndex
CREATE INDEX "Forecast_eventId_createdAt_idx" ON "Forecast"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Evaluation_eventId_evaluatedAt_idx" ON "Evaluation"("eventId", "evaluatedAt");
