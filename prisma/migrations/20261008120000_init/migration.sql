-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignerProduct" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "variantGid" TEXT NOT NULL,
    "widthM" DOUBLE PRECISION NOT NULL,
    "heightM" DOUBLE PRECISION NOT NULL,
    "depthM" DOUBLE PRECISION NOT NULL,
    "modelUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationSet" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationItem" (
    "id" TEXT NOT NULL,
    "recommendationSetId" TEXT NOT NULL,
    "variantGid" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RecommendationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignerProduct_shopDomain_enabled_idx" ON "DesignerProduct"("shopDomain", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "DesignerProduct_shopDomain_variantGid_key" ON "DesignerProduct"("shopDomain", "variantGid");

-- CreateIndex
CREATE INDEX "RecommendationSet_shopDomain_enabled_idx" ON "RecommendationSet"("shopDomain", "enabled");

-- CreateIndex
CREATE INDEX "RecommendationItem_variantGid_idx" ON "RecommendationItem"("variantGid");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationItem_recommendationSetId_variantGid_key" ON "RecommendationItem"("recommendationSetId", "variantGid");

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_recommendationSetId_fkey" FOREIGN KEY ("recommendationSetId") REFERENCES "RecommendationSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
