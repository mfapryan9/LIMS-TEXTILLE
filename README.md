# LIMS Textile Application

Aplikasi Web LIMS (Laboratory Information Management System) untuk pengujian sampel warna kain (Dyeing & Finishing).

## Struktur

```
app/                      layout, halaman utama
components/dashboard/     DashboardClient, SampleTable, header-parts, badges
                          DemoDashboard: data contoh + aksi di browser (mode demo, tanpa database)
lib/cr.ts                 Critical Ratio, urgensi, sortByPriority (+ cr.test.ts, jalankan: npm test)
lib/roles.ts              role, guard assertCan, notifikasi
prisma/schema.prisma      skema Neon PostgreSQL
```

Halaman utama (`/`) membaca data dari Neon dan wajib login (`/login`). Versi demo tanpa database ada di `/demo`.

| Username (password awal `lims12345`, ganti dengan `SEED_PASSWORD` saat seed) | Tampilan |
|---|---|
| operator.lab | Operator |
| kaur.lab | Approver |
| ppic, marketing | Planner |
| kasi, kalab, kepala.ppic, kepala.marketing, admin | Monitor |

**Tambah / edit SPK** (PPIC & Marketing): tombol *Tambah SPK* membuka form dengan kamera atau unggah foto SPK cetak.
Foto dibaca di browser dengan Tesseract.js (`ind+eng`, data bahasa diunduh dari CDN saat pertama kali), lalu
`lib/spk-parse.ts` memetakan teks ke kolom form. Kolom hasil foto ditandai "dari foto" dan semuanya bisa diedit sebelum disimpan.
Format label yang dikenali: `No. SPK`, `Customer`, `Motif`, `Kode Warna`, `Arah Warna`, `Proses`, `Mesin`, `Tgl Terima`, `Due Date`.

Environment variable: `DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon unpooled, untuk migrasi), `AUTH_SECRET` (acak, ≥ 32 karakter).

Perubahan skema: buat migrasi baru di `prisma/migrations`, lalu jalankan `npm run db:migrate` (tidak otomatis saat build Vercel).

## Cara Menjalankan di Lokal

1. Salin `.env.example` menjadi `.env` dan masukkan `DATABASE_URL` dari Neon DB.
2. Install dependensi:
   ```bash
   npm install
   ```
3. Sinkronkan database Prisma ke Neon DB:
   ```bash
   npx prisma db push
   ```
4. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```

## Deployment ke Vercel

1. Push seluruh file di dalam zip ini ke repository GitHub Anda.
2. Buka Vercel dan Import Repository tersebut.
3. Tambahkan Environment Variable:
   - `DATABASE_URL`: Connection string dari Neon DB.
4. Deploy!
