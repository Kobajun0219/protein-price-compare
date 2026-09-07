-- Rename Offer table to ProductPrice and align columns with the new schema.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_name = 'Offer'
			AND table_schema = 'public'
	) THEN
		EXECUTE 'ALTER TABLE "Offer" RENAME TO "ProductPrice"';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'ProductPrice'
			AND table_schema = 'public'
			AND column_name = 'shopName'
	) THEN
		EXECUTE 'ALTER TABLE "ProductPrice" RENAME COLUMN "shopName" TO "sourceName"';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'ProductPrice'
			AND table_schema = 'public'
			AND column_name = 'productUrl'
	) THEN
		EXECUTE 'ALTER TABLE "ProductPrice" RENAME COLUMN "productUrl" TO "sourceUrl"';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'PriceHistory'
			AND table_schema = 'public'
			AND column_name = 'offerId'
	) THEN
		EXECUTE 'ALTER TABLE "PriceHistory" RENAME COLUMN "offerId" TO "productPriceId"';
	END IF;
END $$;

-- Replace the old composite uniqueness with a one-to-one product price record.
DROP INDEX IF EXISTS "Offer_productId_shopName_key";
DROP INDEX IF EXISTS "Offer_productId_idx";
DROP INDEX IF EXISTS "PriceHistory_offerId_fetchedAt_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "ProductPrice_productId_key" ON "ProductPrice"("productId");
CREATE INDEX IF NOT EXISTS "ProductPrice_productId_idx" ON "ProductPrice"("productId");
CREATE INDEX IF NOT EXISTS "PriceHistory_productPriceId_fetchedAt_idx" ON "PriceHistory"("productPriceId", "fetchedAt");
