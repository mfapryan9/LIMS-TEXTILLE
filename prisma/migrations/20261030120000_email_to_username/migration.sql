-- Login memakai username, bukan email. Data lama dipertahankan: username = bagian sebelum "@".
ALTER TABLE "users" RENAME COLUMN "email" TO "username";
ALTER INDEX "users_email_key" RENAME TO "users_username_key";
UPDATE "users" SET "username" = lower(split_part("username", '@', 1));