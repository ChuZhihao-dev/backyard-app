-- CreateTable
CREATE TABLE "DesignerProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "variantGid" TEXT NOT NULL,
    "widthM" REAL NOT NULL,
    "heightM" REAL NOT NULL,
    "depthM" REAL NOT NULL,
    "modelUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "DesignerProduct_shopDomain_enabled_idx" ON "DesignerProduct"("shopDomain", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "DesignerProduct_shopDomain_variantGid_key" ON "DesignerProduct"("shopDomain", "variantGid");
