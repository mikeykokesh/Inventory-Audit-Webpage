-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "auditItemId" TEXT,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentBin" TEXT,
    "expectedBin" TEXT,
    "foundBin" TEXT,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanEvent_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScanEvent_auditItemId_fkey" FOREIGN KEY ("auditItemId") REFERENCES "AuditItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScanEvent_auditId_createdAt_idx" ON "ScanEvent"("auditId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanEvent_auditItemId_idx" ON "ScanEvent"("auditItemId");

-- CreateIndex
CREATE INDEX "AuditItem_auditId_idx" ON "AuditItem"("auditId");

-- CreateIndex
CREATE INDEX "AuditItem_assetId_idx" ON "AuditItem"("assetId");

-- CreateIndex
CREATE INDEX "ItemSerial_sn_idx" ON "ItemSerial"("sn");
