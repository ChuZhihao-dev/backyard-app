-- CreateTable
CREATE TABLE "RecommendationSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecommendationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationSetId" TEXT NOT NULL,
    "variantGid" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RecommendationItem_recommendationSetId_fkey" FOREIGN KEY ("recommendationSetId") REFERENCES "RecommendationSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecommendationSet_shopDomain_enabled_idx" ON "RecommendationSet"("shopDomain", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationItem_recommendationSetId_variantGid_key" ON "RecommendationItem"("recommendationSetId", "variantGid");

-- CreateIndex
CREATE INDEX "RecommendationItem_variantGid_idx" ON "RecommendationItem"("variantGid");
