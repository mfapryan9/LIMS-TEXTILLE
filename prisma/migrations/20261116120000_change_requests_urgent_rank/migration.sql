-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('EDIT', 'DELETE');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "samples" ADD COLUMN     "urgentRank" INTEGER;

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT,
    "type" "ChangeType" NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "label" TEXT NOT NULL,
    "payload" JSONB,
    "reason" TEXT,
    "requestedById" TEXT NOT NULL,
    "requesterName" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "change_requests_status_idx" ON "change_requests"("status");

-- CreateIndex
CREATE INDEX "change_requests_sampleId_idx" ON "change_requests"("sampleId");

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

