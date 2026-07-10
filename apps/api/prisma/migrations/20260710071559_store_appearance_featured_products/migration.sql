-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "aboutText" TEXT,
ADD COLUMN     "banners" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "returnPolicy" TEXT,
ADD COLUMN     "socialLinks" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "themeColor" TEXT;

