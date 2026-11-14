-- Pengajuan: nama pengaju, nama warna, dan nomor partai (lebih dari satu)
ALTER TABLE "samples"
  ADD COLUMN "requesterName" TEXT,
  ADD COLUMN "colorName" TEXT,
  ADD COLUMN "parties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
