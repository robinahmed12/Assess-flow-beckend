/*
  Warnings:

  - A unique constraint covering the columns `[assessmentId,candidateId]` on the table `Invitation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `candidateId` to the `Invitation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "candidateId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_assessmentId_candidateId_key" ON "Invitation"("assessmentId", "candidateId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
