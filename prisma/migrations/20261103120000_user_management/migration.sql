-- Kelola pengguna oleh Kepala Laboratorium + invalidasi sesi setelah ganti / reset password
ALTER TABLE "roles" ADD COLUMN "canManageUsers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
