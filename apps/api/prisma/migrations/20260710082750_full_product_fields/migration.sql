-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "costPrice" DECIMAL(12,2),
ADD COLUMN     "maxQty" INTEGER,
ADD COLUMN     "minQty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "weightGrams" INTEGER;

