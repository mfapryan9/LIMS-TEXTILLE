-- Sprint 3: pengajuan dari PPIC, diproses operator (nama pemroses), selesai dengan foto hasil uji.
ALTER TABLE "roles" ADD COLUMN "canInterveneUrgent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "samples"
  ADD COLUMN "processorName" TEXT,
  ADD COLUMN "processStartedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "resultNote" TEXT;

CREATE TABLE "result_photos" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "result_photos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "result_photos_sampleId_key" ON "result_photos"("sampleId");
ALTER TABLE "result_photos" ADD CONSTRAINT "result_photos_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alur baru tanpa approval / rework: sampel aktif berstatus lama dipindahkan ke alur baru
UPDATE "samples" SET "status" = 'DALAM_PROSES' WHERE "status" = 'MENUNGGU_APPROVAL';
UPDATE "samples" SET "status" = 'MENUNGGU' WHERE "status" = 'MATCHING_ULANG';
UPDATE "samples" SET "processorName" = 'Operator Lab', "processStartedAt" = CURRENT_TIMESTAMP
  WHERE "status" = 'DALAM_PROSES' AND "processorName" IS NULL;