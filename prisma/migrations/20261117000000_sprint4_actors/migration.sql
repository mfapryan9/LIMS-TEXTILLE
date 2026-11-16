-- Aktor Sprint 4
-- PPIC -> Kepala Urusan PPIC, Operator Lab -> Admin Lab, Kepala Seksi -> Kepala Seksi Laboratorium (operasional lab)
UPDATE "roles" SET "code" = 'KAUR_PPIC', "name" = 'Kepala Urusan PPIC' WHERE "code" = 'PPIC';
UPDATE "roles" SET "code" = 'ADMIN_LAB', "name" = 'Admin Lab' WHERE "code" = 'OPERATOR_LAB';
UPDATE "roles" SET "code" = 'KASI_LAB', "name" = 'Kepala Seksi Laboratorium', "viewMode" = 'OPERATOR',
  "canInterveneUrgent" = false, "canEditSample" = false, "canEditDue" = false, "canMarkUrgent" = false WHERE "code" = 'KASI';

UPDATE "users" SET "username" = 'kaur.ppic', "name" = 'Kepala Urusan PPIC' WHERE "username" = 'ppic';
UPDATE "users" SET "username" = 'admin.lab', "name" = 'Admin Lab' WHERE "username" = 'operator.lab';
UPDATE "users" SET "username" = 'kasi.lab', "name" = 'Kepala Seksi Laboratorium' WHERE "username" = 'kasi';

-- Admin Sistem & Kepala Urusan Laboratorium dihapus (akun tanpa riwayat)
DELETE FROM "users" u
WHERE u."username" IN ('admin', 'kaur.lab')
  AND NOT EXISTS (SELECT 1 FROM "samples" s WHERE s."createdById" = u."id" OR s."urgentById" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "test_trials" t WHERE t."operatorId" = u."id" OR t."approverId" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "audit_logs" a WHERE a."userId" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "change_requests" c WHERE c."requestedById" = u."id" OR c."decidedById" = u."id");
UPDATE "users" SET "isActive" = false WHERE "username" IN ('admin', 'kaur.lab');
DELETE FROM "roles" r WHERE r."code" IN ('ADMIN', 'KAUR_LAB') AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."roleId" = r."id");
