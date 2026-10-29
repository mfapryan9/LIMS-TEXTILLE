# LIMS Textile Application

Aplikasi Web LIMS (Laboratory Information Management System) untuk pengujian sampel warna kain (Dyeing & Finishing).

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
