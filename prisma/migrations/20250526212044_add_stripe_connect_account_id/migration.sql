/*
  Warnings:

  - A unique constraint covering the columns `[stripeConnectAccountId]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "stripeConnectAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_stripeConnectAccountId_key" ON "Profile"("stripeConnectAccountId");
