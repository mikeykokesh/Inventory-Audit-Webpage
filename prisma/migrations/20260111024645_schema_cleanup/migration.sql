-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "item" TEXT,
    "description" TEXT,
    "prefVendor" TEXT,
    "onHand" REAL,
    "physicalCount" REAL,
    "countVariance" REAL,
    "expectedBin" TEXT,
    "serialsRaw" TEXT,
    "assetId" TEXT,
    "notes" TEXT,
    "currentOnHandValue" REAL,
    "currentValueVariance" REAL,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "foundStatus" TEXT,
    "foundAt" DATETIME,
    "foundBin" TEXT,
    "reviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemSerial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditItemId" TEXT NOT NULL,
    "sn" TEXT NOT NULL,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "foundAt" DATETIME,
    CONSTRAINT "ItemSerial_auditItemId_fkey" FOREIGN KEY ("auditItemId") REFERENCES "AuditItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemSerial_auditItemId_sn_key" ON "ItemSerial"("auditItemId", "sn");
