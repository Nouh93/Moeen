-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "minOrderTotal" DECIMAL(12,2),
ADD COLUMN     "thankYouNote" TEXT,
ADD COLUMN     "vacationMessage" TEXT,
ADD COLUMN     "vacationMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BlockedCustomer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedCustomer_storeId_phone_key" ON "BlockedCustomer"("storeId", "phone");

-- AddForeignKey
ALTER TABLE "BlockedCustomer" ADD CONSTRAINT "BlockedCustomer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

