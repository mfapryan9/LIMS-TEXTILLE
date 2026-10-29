# LIMS Priority Scheduling – PT Nagasakti

Next.js (App Router) · Tailwind · Prisma · Neon PostgreSQL · Vercel

## Struktur

```
prisma/schema.prisma                  Users, Roles, Samples, ProcessTypes, Machines,
                                      MasterProcessTimes, TestTrials, AuditLogs
src/lib/cr.ts                         Hitung CR, klasifikasi urgensi, sortByPriority, due date +7 hari
src/lib/cr.test.ts                    Unit test (vitest)
src/lib/roles.ts                      Seed role, assertCan() guard server, notifikasi turunan
src/app/(app)/dashboard/page.tsx      Server Component: ambil data → hitung CR → urutkan → kirim ke client
src/app/actions.ts                    (BELUM DIBUAT) Server Actions, lihat interface SampleActions
src/components/dashboard/
  DashboardClient.tsx                 Shell, tab default & teks per role, state filter
  header-parts.tsx                    NotificationBell, StatsStrip, FilterBar + applyFilters
  SampleTable.tsx                     Tabel antrean + aksi per role (Operator / Approver / Planner / Monitor)
  badges.tsx                          CrBadge (merah/kuning), UrgentBadge, StatusBadge, tipe SampleRow
```

## Alur data

1. `page.tsx` membaca Sample + MasterProcessTimes, lalu `withCR()` → `sortByPriority()`.
2. Notifikasi diturunkan dari hasil yang sama (`deriveNotifications`), tanpa tabel tambahan.
3. Client hanya menyaring/mencari; urutan CR tidak diubah.
4. Tombol disembunyikan di UI, tetapi izin sebenarnya dicek di server dengan `assertCan()`.

## Tampilan per role

| Role | viewMode | Fokus |
|---|---|---|
| Operator Lab | OPERATOR | Antrean aktif, Mulai/Selesai Uji, percobaan ke-n |
| Kepala Urusan Lab | APPROVER | Daftar menunggu approval, Approve / Reject (rework) |
| PPIC, Marketing | PLANNER | Kesiapan sampel, ubah due date, tandai urgent |
| Kasi, Kepala Lab, Kepala PPIC, Kepala Marketing | MONITOR | Hanya lihat |

## Setup

```bash
npm i prisma @prisma/client @prisma/adapter-neon next-auth@beta bcryptjs
npm i -D vitest
# .env: DATABASE_URL (pooled Neon), DIRECT_URL (unpooled Neon), AUTH_SECRET
npx prisma migrate dev --name init
npx vitest run
```

Tambahkan CHECK constraint di migration agar p tidak bisa 0 atau negatif:

```sql
ALTER TABLE master_process_times ADD CONSTRAINT p_positive CHECK ("standardDays" > 0);
```

## Keputusan desain yang perlu dikonfirmasi

- **Zona waktu**: "hari ini" dihitung pada tanggal kalender Asia/Jakarta, bukan UTC, agar CR tidak bergeser di server Vercel.
- **p belum diisi**: CR bernilai null, badge "p belum diatur", dan sampel ditaruh setelah yang punya CR. Jika lewat due date tetap ditandai terlambat.
- **Urgent**: hanya badge dan notifikasi, tidak mengubah urutan CR (sesuai spesifikasi). Jika ingin urgent selalu di atas, tambahkan satu aturan di `sortByPriority`.
- **Unik sampel**: `(spkNo, colorCode)`, karena satu SPK bisa memuat beberapa warna.
- **Reject**: Kepala Urusan Lab wajib mengisi alasan; status menjadi MATCHING_ULANG dan percobaan berikutnya (n+1) dimulai operator.
