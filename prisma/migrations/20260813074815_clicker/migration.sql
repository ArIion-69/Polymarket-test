-- CreateTable
CREATE TABLE "ClickerSave" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'local',
    "cope" REAL NOT NULL DEFAULT 0,
    "totalCope" REAL NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "upgradesJson" TEXT NOT NULL DEFAULT '{}',
    "premiumJson" TEXT NOT NULL DEFAULT '{}',
    "lastTick" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClickerPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClickerPurchase_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "ClickerSave" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClickerEventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClickerEventLog_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "ClickerSave" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ClickerPurchase_saveId_createdAt_idx" ON "ClickerPurchase"("saveId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickerEventLog_saveId_createdAt_idx" ON "ClickerEventLog"("saveId", "createdAt");
