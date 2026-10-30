-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('PRODUKSI', 'MARKETING');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('MENUNGGU', 'DALAM_PROSES', 'MENUNGGU_APPROVAL', 'DISETUJUI', 'MATCHING_ULANG');

-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('BERJALAN', 'SELESAI');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ViewMode" AS ENUM ('OPERATOR', 'APPROVER', 'PLANNER', 'MONITOR');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewMode" "ViewMode" NOT NULL,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canEditDue" BOOLEAN NOT NULL DEFAULT false,
    "canMarkUrgent" BOOLEAN NOT NULL DEFAULT false,
    "canManageMaster" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notificationsSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "process_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_process_times" (
    "id" TEXT NOT NULL,
    "processTypeId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "standardDays" DECIMAL(6,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_process_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "samples" (
    "id" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "spkNo" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "colorDirection" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "processTypeId" TEXT NOT NULL,
    "fabricProblem" TEXT,
    "problemDescription" TEXT,
    "receivedDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "machineId" TEXT NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'MENUNGGU',
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "urgentReason" TEXT,
    "urgentById" TEXT,
    "urgentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_trials" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "trialNo" INTEGER NOT NULL,
    "operatorId" TEXT NOT NULL,
    "status" "TrialStatus" NOT NULL DEFAULT 'BERJALAN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectNote" TEXT,

    CONSTRAINT "test_trials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sampleId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "process_types_code_key" ON "process_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "machines_code_key" ON "machines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "master_process_times_processTypeId_machineId_key" ON "master_process_times"("processTypeId", "machineId");

-- CreateIndex
CREATE INDEX "samples_status_idx" ON "samples"("status");

-- CreateIndex
CREATE INDEX "samples_dueDate_idx" ON "samples"("dueDate");

-- CreateIndex
CREATE INDEX "samples_customerName_idx" ON "samples"("customerName");

-- CreateIndex
CREATE UNIQUE INDEX "samples_spkNo_colorCode_key" ON "samples"("spkNo", "colorCode");

-- CreateIndex
CREATE UNIQUE INDEX "test_trials_sampleId_trialNo_key" ON "test_trials"("sampleId", "trialNo");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_process_times" ADD CONSTRAINT "master_process_times_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "process_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_process_times" ADD CONSTRAINT "master_process_times_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "process_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_urgentById_fkey" FOREIGN KEY ("urgentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_trials" ADD CONSTRAINT "test_trials_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_trials" ADD CONSTRAINT "test_trials_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_trials" ADD CONSTRAINT "test_trials_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- p (waktu proses standar) tidak boleh 0 atau negatif
ALTER TABLE "master_process_times" ADD CONSTRAINT "p_positive" CHECK ("standardDays" > 0);
