# LIMS Textile Application

Aplikasi Web LIMS (Laboratory Information Management System) untuk pengujian sampel warna kain (Dyeing & Finishing)
PT Nagasakti Kurnia Textile Mills. Next.js 14 · Prisma · Neon PostgreSQL · Vercel.

## Struktur

```
app/page.tsx              dashboard (server): ambil data → hitung CR hari ini → urutkan → riwayat uji
app/actions.ts            server actions: uji, approve/reject, tambah/edit SPK, due date, urgent (assertCan + audit log)
app/login/                login username + password
components/dashboard/     DashboardClient (tab Antrean / Hasil uji selesai), SampleTable, ResultsTable,
                          SampleForm (kamera + OCR + edit), header-parts, badges
lib/cr.ts                 Critical Ratio, urgensi, sortByPriority
lib/spk-parse.ts          teks OCR kartu SPK → isian form
lib/roles.ts              role, guard assertCan, notifikasi
prisma/schema.prisma      skema database; prisma/migrations: riwayat migrasi
prisma/data/excel-history.json  32 sampel dari "SAMPLE ORDERAN SPK.xlsx" (satu per nilai CR berbeda tiap sheet)
prisma/seed.ts            role, akun, master dari Excel, riwayat Excel, contoh antrean aktif
```

## Alur & hak akses

Login memakai **username**. Password awal akun hasil seed: `lims12345` (atau `SEED_PASSWORD`).

| Username | Tampilan | Hak |
|---|---|---|
| operator.lab | Operator | Tambah SPK (scan kartu), edit SPK, mulai/selesai uji ke-n |
| kaur.lab, kasi | Kepala (approver) | Tambah & edit SPK, ACC / reject hasil uji, tab **Hasil uji selesai** |
| ppic, marketing | Planner | Tambah & edit SPK, ubah due date, tandai urgent |
| kalab, kepala.ppic, kepala.marketing, admin | Monitor | Hanya lihat (termasuk hasil uji selesai) |

Setiap sampel menampilkan berapa kali sudah diuji/matching dengan master, jumlah rework (beserta alasan terakhir),
dan lama di lab. Sampel yang di-ACC mencatat **ACC pada uji ke-n**, tanggal ACC, approver, dan durasi sejak masuk lab
(tanggal terima, atau mulai uji pertama bila lebih awal).

## Critical Ratio

`CR = (due date − hari ini) / p` dengan hari dihitung per tanggal kalender WIB dan `p` = processing time per
kelompok proses/mesin (satu sheet Excel = satu mesin: Thermosol, CPB, Stenter, Washing, Jet Dyeing).
Urutan antrean: **URGENT selalu paling atas** (latar fuchsia mencolok), lalu CR terkecil, lalu sampel tanpa p, lalu yang sudah ACC.
Dashboard memuat ulang data tiap 5 menit dan saat tab dibuka kembali, jadi CR mengikuti pergantian tanggal.

Validasi terhadap Excel: Excel menghitung `CR = (DUE DATE − TGL ORDER) / p`. `lib/cr.excel.test.ts` memastikan
`calculateCR` dengan "hari ini" = TGL ORDER menghasilkan angka yang sama untuk ke-32 sampel (`npm test`).
Nilai ini juga tampil sebagai **CR awal** di tab Hasil uji selesai.

## Tambah / edit SPK dengan kamera

Tombol *Tambah SPK* membuka form dengan kamera atau unggah foto kartu SPK cetak. Foto dibaca di browser dengan
Tesseract.js (`ind+eng`, data bahasa diunduh dari CDN saat pertama kali), lalu `lib/spk-parse.ts` memetakan teks ke
kolom form. Kolom hasil foto ditandai "dari foto" dan semuanya bisa diedit sebelum disimpan. Memilih proses mengisi mesin otomatis.
Label yang dikenali: `No. Order`, `Tgl Order`, `No. SPK`, `Proses Lab`, `Tgl Terima`, `Due Date` (juga `Customer`,
`Motif`, `Kode Warna`, `Arah Warna`, `Mesin`); `Tgl Mulai` / `Tgl Selesai` diabaikan.

## Menjalankan

Environment variable: `DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon unpooled, untuk migrasi), `AUTH_SECRET` (acak, ≥ 32 karakter).

```bash
npm install
npm run db:migrate          # terapkan migrasi ke Neon (tidak otomatis saat build Vercel)
npx prisma db seed          # isi role, akun, master; sampel hanya bila tabel kosong
SEED_RESET=1 npx prisma db seed   # HAPUS semua sampel/uji/audit/master lalu isi ulang dari Excel + contoh
npm run dev
npm test
```

Deploy: setiap push ke `main` di GitHub otomatis di-deploy oleh Vercel (env di atas sudah diatur di project Vercel).
