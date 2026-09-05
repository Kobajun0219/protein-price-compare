-- Rename Offer table to ProductPrice and align columns with the new schema.
ALTER TABLE "Offer" RENAME TO "ProductPrice";
ALTER TABLE "ProductPrice" RENAME COLUMN "shopName" TO "sourceName";
ALTER TABLE "ProductPrice" RENAME COLUMN "productUrl" TO "sourceUrl";
ALTER TABLE "PriceHistory" RENAME COLUMN "offerId" TO "productPriceId";

-- Replace the old composite uniqueness with a one-to-one product price record.
DROP INDEX IF EXISTS "Offer_productId_shopName_key";
DROP INDEX IF EXISTS "Offer_productId_idx";
DROP INDEX IF EXISTS "PriceHistory_offerId_fetchedAt_idx";

CREATE UNIQUE INDEX "ProductPrice_productId_key" ON "ProductPrice"("productId");
CREATE INDEX "ProductPrice_productId_idx" ON "ProductPrice"("productId");
CREATE INDEX "PriceHistory_productPriceId_fetchedAt_idx" ON "PriceHistory"("productPriceId", "fetchedAt");
