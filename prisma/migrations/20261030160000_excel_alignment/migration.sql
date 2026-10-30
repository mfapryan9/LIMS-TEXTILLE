-- Penyesuaian dengan data Excel "SAMPLE ORDERAN SPK.xlsx" dan revisi hak akses.

-- p presisi tinggi agar CR sama dengan Excel (mis. Stenter p = 1.333333). CHECK p_positive tetap berlaku.
ALTER TABLE "master_process_times" ALTER COLUMN "standardDays" SET DATA TYPE DECIMAL(10,6);

-- Hak tambah (scan) & edit SPK dipisah dari hak ubah due date.
ALTER TABLE "roles" ADD COLUMN "canEditSample" BOOLEAN NOT NULL DEFAULT false;

-- NO. ORDER & TGL ORDER dari kartu SPK; data customer/motif/warna tidak selalu ada di SPK → opsional.
ALTER TABLE "samples" ADD COLUMN "orderDate" DATE,
ADD COLUMN "orderNo" TEXT,
ALTER COLUMN "customerName" DROP NOT NULL,
ALTER COLUMN "motif" DROP NOT NULL,
ALTER COLUMN "colorDirection" DROP NOT NULL,
ALTER COLUMN "colorCode" DROP NOT NULL;